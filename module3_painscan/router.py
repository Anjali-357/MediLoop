from fastapi import APIRouter
from typing import List, Optional
from pydantic import BaseModel
import numpy as np
from datetime import datetime

from shared.database import db
from shared.events import publish
from shared.models import APIResponse
from .service import process_frame

router = APIRouter()

class FrameInput(BaseModel):
    image: str
    audio_chunk: Optional[str] = None

class ScoreInput(BaseModel):
    patient_id: str
    followup_id: str
    frame_scores: List[int]
    
    # Multimodal Tracking
    resp_rate: Optional[float] = None
    heart_rate: Optional[float] = None
    cry_intensity: Optional[float] = None
    agitation_score: Optional[float] = None
    risk_level: Optional[str] = None
    modalities_used: Optional[List[str]] = None

@router.post("/analyze-frame", response_model=APIResponse)
async def analyze_frame(payload: FrameInput):
    result = await process_frame(payload.image, payload.audio_chunk)
    if not result.get("face_detected"):
        return APIResponse(success=False, message="Move closer", data={"face_detected": False})
    
    return APIResponse(success=True, message="Face tracked", data=result)

@router.post("/score", response_model=APIResponse)
async def submit_score(payload: ScoreInput):
    if not payload.frame_scores:
        score = 0
    else:
        # Final aggregation logic across frames favors the top quartile (75%)
        score = int(np.percentile(payload.frame_scores, 75))
        
    doc = {
        "patient_id": payload.patient_id,
        "followup_id": payload.followup_id,
        "score": score,
        "frame_scores": payload.frame_scores,
        "frame_count": len(payload.frame_scores),
        "created_at": datetime.utcnow()
    }
    
    # Bind optional metrics securely
    if payload.resp_rate is not None: doc["resp_rate"] = payload.resp_rate
    if payload.heart_rate is not None: doc["heart_rate"] = payload.heart_rate
    if payload.cry_intensity is not None: doc["cry_intensity"] = payload.cry_intensity
    if payload.agitation_score is not None: doc["agitation_score"] = payload.agitation_score
    if payload.risk_level is not None: doc["risk_level"] = payload.risk_level
    if payload.modalities_used is not None: doc["modalities_used"] = payload.modalities_used
    
    insert_result = await db.pain_scores.insert_one(doc)
    doc["_id"] = str(insert_result.inserted_id)
    
    # Existing Master PRD Trigger Maintained completely safely
    await publish("pain.scored", {
        "patient_id": payload.patient_id,
        "score": score,
        "followup_id": payload.followup_id
    })
    
    # New Multimodal Trigger Enhancements
    event_payload = {
        "patient_id": payload.patient_id,
        "followup_id": payload.followup_id,
        "score": score,
        "risk_level": payload.risk_level or "LOW"
    }
    
    await publish("pain.multimodal_scored", event_payload)
    
    # Dispatch specific anomaly alerting loops securely down Redis
    if payload.risk_level == "HIGH":
        if payload.resp_rate is not None and payload.resp_rate > 40:
            await publish("respiratory.distress.detected", event_payload)
        
        # Distress from facial signs without audio means "Silent distress"
        if not payload.cry_intensity or payload.cry_intensity < 0.2:
            await publish("silent_distress.detected", event_payload)
    
    return APIResponse(success=True, message="Pain score saved", data=doc)

@router.get("/history/{patient_id}", response_model=APIResponse)
async def get_history(patient_id: str):
    cursor = db.pain_scores.find({"patient_id": patient_id}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return APIResponse(success=True, message="History retrieved", data=docs)
