"""
module5_orchestrator/router.py
FastAPI router for the AI Intent Router & Care Orchestration Engine.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime

from shared.database import db
from shared.models import APIResponse
from module5_orchestrator.intent_classifier import classify_intent, INTENT_TO_MODULE
from module5_orchestrator.decision_engine import store_decision, execute_decision

router = APIRouter()


class AnalyzeMessageRequest(BaseModel):
    patient_id: str
    message: str
    trigger_source: str = "whatsapp"


class ManualTriggerRequest(BaseModel):
    patient_id: str
    module: str   # painscan | recoverbot | caregap | chatbot | emergency
    reason: str = "Manual trigger by doctor"


def _serialize(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.post("/analyze-message", response_model=APIResponse)
async def analyze_message(req: AnalyzeMessageRequest):
    """
    Classify a patient message intent with Gemini and route to the correct module.
    """
    # Fetch patient context
    try:
        patient = await db.patients.find_one({"_id": ObjectId(req.patient_id)})
    except Exception:
        patient = await db.patients.find_one({"_id": req.patient_id})

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get recent conversation history from followups
    followup = await db.followups.find_one({"patient_id": req.patient_id})
    recent_history = []
    if followup:
        recent_history = followup.get("conversation_log", [])[-4:]

    diagnosis = ""
    consult = await db.consultations.find_one({"patient_id": req.patient_id})
    if consult:
        diagnosis = consult.get("diagnosis", "")

    # Classify intent
    classification = await classify_intent(
        message=req.message,
        patient_name=patient.get("name", "Patient"),
        diagnosis=diagnosis or ", ".join(patient.get("chronic_conditions", [])) or "general health",
        recent_history=recent_history,
        is_pediatric=patient.get("is_pediatric", False),
        age=patient.get("age", 0),
    )

    intent = classification["intent"]
    suggested_module = INTENT_TO_MODULE.get(intent, "chatbot")

    # Store decision
    decision_id = await store_decision(
        patient_id=req.patient_id,
        intent=intent,
        confidence=classification["confidence"],
        reasoning=classification.get("reasoning", ""),
        suggested_module=suggested_module,
        trigger_source=req.trigger_source,
    )

    # Execute routing action
    action_result = await execute_decision(
        patient_id=req.patient_id,
        intent=intent,
        patient=patient,
        message=req.message,
        suggested_module=suggested_module,
    )

    return APIResponse(
        success=True,
        data={
            "decision_id": decision_id,
            "intent": intent,
            "confidence": classification["confidence"],
            "reasoning": classification.get("reasoning", ""),
            "suggested_module": suggested_module,
            "action_taken": action_result["action_taken"],
        },
        message=f"Message classified as {intent} → routed to {suggested_module}",
    )


@router.post("/manual-trigger", response_model=APIResponse)
async def manual_trigger(req: ManualTriggerRequest):
    """Doctor manually triggers a module for a patient."""
    try:
        patient = await db.patients.find_one({"_id": ObjectId(req.patient_id)})
    except Exception:
        patient = await db.patients.find_one({"_id": req.patient_id})

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Map module name to intent
    module_to_intent = {
        "painscan": "PAIN",
        "recoverbot": "FOLLOWUP",
        "caregap": "CARE_GAP",
        "chatbot": "GENERAL_QUERY",
        "emergency": "EMERGENCY",
    }
    intent = module_to_intent.get(req.module, "GENERAL_QUERY")

    decision_id = await store_decision(
        patient_id=req.patient_id,
        intent=intent,
        confidence=1.0,
        reasoning=req.reason,
        suggested_module=req.module,
        trigger_source="manual_doctor",
    )

    action_result = await execute_decision(
        patient_id=req.patient_id,
        intent=intent,
        patient=patient,
        message=req.reason,
        suggested_module=req.module,
    )

    return APIResponse(
        success=True,
        data={
            "decision_id": decision_id,
            "module_triggered": req.module,
            "action_taken": action_result["action_taken"],
        },
        message=f"Manual trigger: {req.module} activated for patient {patient.get('name')}",
    )


@router.get("/history/{patient_id}", response_model=APIResponse)
async def get_decision_history(patient_id: str):
    """Fetch AI decision history for a patient."""
    cursor = db.ai_decisions.find({"patient_id": patient_id}).sort("created_at", -1).limit(50)
    decisions = await cursor.to_list(length=50)
    return APIResponse(
        success=True,
        data=[_serialize(d) for d in decisions],
        message=f"Fetched {len(decisions)} decisions",
    )


@router.get("/recent", response_model=APIResponse)
async def get_recent_decisions(limit: int = 20):
    """Fetch the most recent AI decisions across all patients."""
    cursor = db.ai_decisions.find({}).sort("created_at", -1).limit(limit)
    decisions = await cursor.to_list(length=limit)
    return APIResponse(
        success=True,
        data=[_serialize(d) for d in decisions],
        message=f"Fetched {len(decisions)} recent decisions",
    )
