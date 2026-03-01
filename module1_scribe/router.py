import os
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from bson import ObjectId

from shared.database import db
from shared.models import APIResponse
from shared.events import publish
from .services import process_audio_chunk, generate_soap_note, map_icd_codes
import google.generativeai as genai

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
            data = await websocket.receive_bytes()
            partial_text = await process_audio_chunk(data, session_id)
            if partial_text:
                full_transcript += partial_text + " "
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
    try:
        patient_id = request_data.get("patient_id")
        doctor_id  = request_data.get("doctor_id")
        transcript = request_data.get("transcript", "")

        if not patient_id or not transcript:
            raise HTTPException(status_code=400, detail="Missing patient_id or transcript")

        soap_note = await generate_soap_note(transcript)
        icd_text  = f"Assessment: {soap_note.get('assessment', '')} Plan: {soap_note.get('plan', '')}"
        icd_codes = await map_icd_codes(icd_text)

        # Generate summary_short via Gemini
        summary_short = "Consultation recorded."
        try:
            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f"Summarize this doctor-patient consultation in exactly one very short, clinical sentence based on the following SOAP note: {json.dumps(soap_note)}"
            res = model.generate_content(prompt)
            if res and res.text:
                summary_short = res.text.strip()
        except Exception as summary_err:
            logger.error(f"Failed to generate summary_short: {summary_err}")

        consultation_doc = {
            "patient_id":  patient_id,
            "doctor_id":   doctor_id,
            "transcript":  transcript,
            "soap_note":   soap_note,
            "icd_codes":   icd_codes,
            "summary_short": summary_short,
            "status":      "approved",
            "created_at":  datetime.utcnow()
        }

        result          = await db.consultations.insert_one(consultation_doc)
        consultation_id = str(result.inserted_id)

        await publish("consultation.completed", {
            "patient_id":      patient_id,
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
        result = await db.consultations.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"status": "discharged"}}
        )

        if result.modified_count == 0:
            return APIResponse(success=False, data=None, message="Patient not found or already discharged")

        doc        = await db.consultations.find_one({"_id": ObjectId(id)})
        patient_id = doc.get("patient_id")
        soap       = doc.get("soap_note", {})

        # ── Send discharge summary WhatsApp ───────────────────────────────────
        try:
            from module6_commhub.gateway import send_whatsapp
            from module6_commhub.router import _log

            patient = await db.patients.find_one({"_id": ObjectId(patient_id)}) if patient_id else None
            if patient and patient.get("phone"):
                name       = patient.get("name", "Patient")
                assessment = soap.get("assessment", "")
                plan       = soap.get("plan", "")

                lines = [f"Hi {name}, your consultation is now complete. 🏥\n"]
                if assessment:
                    lines.append(f"📋 *Assessment:* {assessment}")
                if plan:
                    lines.append(f"💊 *Your Plan:* {plan}")
                lines.append(
                    "\nPlease follow your doctor's instructions. "
                    "Reply anytime if you feel unwell or have questions. 💙\n"
                    "Reply *appointment* to request a follow-up visit."
                )
                msg = "\n".join(lines)

                send_whatsapp(patient["phone"], msg)
                await _log(patient_id, "discharge_summary", msg)
                print(f"[Scribe] Discharge summary → {name}")

        except Exception as we:
            print(f"[Scribe] Discharge WhatsApp error (non-fatal): {we}")

        # Publish patient.discharged event
        await publish("patient.discharged", {
            "patient_id":      patient_id,
            "consultation_id": id
        })

        return APIResponse(
            success=True,
            data={"consultation_id": id, "status": "discharged"},
            message="Patient discharged and summary sent via WhatsApp"
        )
    except Exception as e:
        return APIResponse(success=False, data=None, message=str(e))
