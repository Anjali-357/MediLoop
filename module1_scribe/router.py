import os
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
from bson import ObjectId

from shared.database import db
from shared.models import APIResponse
from shared.events import publish
from .services import process_audio_chunk, generate_soap_note, map_icd_codes

router = APIRouter()
logger = logging.getLogger(__name__)

# Track active websocket connections
active_connections = {}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket
    print(f"WebSocket connected for session: {session_id}")
    
    full_transcript = ""
    
    try:
        while True:
            # Note: expecting chunks of audio data either as bytes or base64. 
            # Depending on MediaRecorder, this could come as bytes directly.
            data = await websocket.receive_bytes()
            
            # Process the audio chunk real-time to text
            partial_text = await process_audio_chunk(data, session_id)
            
            if partial_text:
                full_transcript += partial_text + " "
                # Echo partial text back to frontend
                await websocket.send_json({
                    "type": "transcript_update",
                    "text": full_transcript
                })

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session: {session_id}")
        if session_id in active_connections:
            del active_connections[session_id]

@router.post("/consultation", response_model=APIResponse)
async def save_consultation(request_data: dict):
    # Generates SOAP and ICD-10 from the given transcript and saves to DB.
    try:
        patient_id = request_data.get("patient_id")
        doctor_id = request_data.get("doctor_id")
        transcript = request_data.get("transcript", "")

        if not patient_id or not transcript:
            raise HTTPException(status_code=400, detail="Missing patient_id or transcript")

        # 1. Generate SOAP note via Gemini
        soap_note = await generate_soap_note(transcript)

        # 2. Map ICD-10 codes via Llama3 using Assessment + Plan
        icd_text = f"Assessment: {soap_note.get('assessment', '')} Plan: {soap_note.get('plan', '')}"
        icd_codes = await map_icd_codes(icd_text)

        # 3. Create consultation document
        consultation_doc = {
            "patient_id": patient_id, # Plain string as per rule
            "doctor_id": doctor_id,    # Plain string
            "transcript": transcript,
            "soap_note": soap_note,
            "icd_codes": icd_codes,
            "status": "approved", # Assuming final save makes it approved
            "created_at": datetime.utcnow()
        }

        result = await db.consultations.insert_one(consultation_doc)
        consultation_id = str(result.inserted_id)

        # 4. Fire Redis event consultation.completed
        await publish("consultation.completed", {
            "patient_id": patient_id,
            "consultation_id": consultation_id
        })

        return APIResponse(
            success=True,
            data={"consultation_id": consultation_id},
            message="Consultation saved successfully"
        )
    except Exception as e:
        logger.error(f"Error saving consultation: {e}")
        return APIResponse(success=False, data=None, message=str(e))

@router.get("/consultation/{id}", response_model=APIResponse)
async def get_consultation(id: str):
    try:
        consultation = await db.consultations.find_one({"_id": ObjectId(id)})
        if not consultation:
            return APIResponse(success=False, data=None, message="Not found")
        
        # Stringify _id since Pydantic handles it
        consultation["_id"] = str(consultation["_id"])
        
        return APIResponse(success=True, data=consultation, message="Success")
    except Exception as e:
        return APIResponse(success=False, data=None, message=str(e))

@router.get("/consultations", response_model=APIResponse)
async def get_consultations(patient_id: str):
    try:
        cursor = db.consultations.find({"patient_id": patient_id}).sort("created_at", -1)
        consultations = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            consultations.append(doc)
            
        return APIResponse(success=True, data=consultations, message="Success")
    except Exception as e:
        return APIResponse(success=False, data=None, message=str(e))

@router.patch("/consultation/{id}/discharge", response_model=APIResponse)
async def discharge_patient(id: str):
    try:
        # Update consultation status
        result = await db.consultations.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"status": "discharged"}}
        )
        
        if result.modified_count == 0:
            return APIResponse(success=False, data=None, message="Patient not found or already discharged")

        # Fetch doc to get patient_id
        doc = await db.consultations.find_one({"_id": ObjectId(id)})
        patient_id = doc.get("patient_id")
        
        # Publish patient.discharged
        await publish("patient.discharged", {
            "patient_id": patient_id,
            "consultation_id": id
        })

        return APIResponse(success=True, data={"consultation_id": id, "status": "discharged"}, message="Patient discharged successfully")
    except Exception as e:
        return APIResponse(success=False, data=None, message=str(e))
