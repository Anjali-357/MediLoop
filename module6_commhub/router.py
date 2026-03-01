"""
module6_commhub/router.py
FastAPI router for CommHub — manual send, initiate, and session log endpoints.
"""
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from shared.database import db
from shared.models import APIResponse
from shared.events import publish
from module6_commhub.gateway import send_whatsapp
from module6_commhub.message_templates import welcome_new_patient, welcome_returning, manual_message

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")


@router.get("/patients", response_model=APIResponse)
async def list_patients():
    """Public endpoint: list all patients for dropdowns (no auth required)."""
    cursor = db.patients.find({}, {"name": 1, "phone": 1, "age": 1, "is_pediatric": 1})
    patients = await cursor.to_list(length=200)
    data = [{"_id": str(p["_id"]), "name": p.get("name", ""), "phone": p.get("phone", ""),
             "age": p.get("age", 0), "is_pediatric": p.get("is_pediatric", False)}
            for p in patients]
    return APIResponse(success=True, data=data, message=f"{len(data)} patients")


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    for key in ("last_message_ts",):
        if isinstance(doc.get(key), datetime):
            doc[key] = doc[key].isoformat()
    if "messages" in doc:
        for m in doc["messages"]:
            if isinstance(m.get("ts"), datetime):
                m["ts"] = m["ts"].isoformat()
    return doc


class SendRequest(BaseModel):
    patient_id: str
    message: str
    module: str = "manual"


async def _get_patient(patient_id: str) -> dict | None:
    try:
        return await db.patients.find_one({"_id": ObjectId(patient_id)})
    except Exception:
        return await db.patients.find_one({"_id": patient_id})


async def _log(patient_id: str, active_module: str, body: str):
    now = datetime.now(timezone.utc)
    await db.message_sessions.update_one(
        {"patient_id": patient_id, "channel": "whatsapp"},
        {
            "$set": {"active_module": active_module, "last_message_ts": now},
            "$push": {"messages": {"direction": "outbound", "module": active_module, "body": body[:500], "ts": now}},
            "$setOnInsert": {"patient_id": patient_id, "channel": "whatsapp", "conversation_state": "active"},
        },
        upsert=True,
    )


@router.post("/send", response_model=APIResponse)
async def send_message(req: SendRequest):
    """Manually send a WhatsApp message to a patient."""
    patient = await _get_patient(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    phone = patient.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="Patient has no phone number")

    body = manual_message(req.message)
    success = send_whatsapp(phone, body)
    await _log(req.patient_id, req.module, body)

    return APIResponse(
        success=success,
        data={"phone": phone},
        message="Message sent" if success else "Failed to send message",
    )


@router.post("/initiate/{patient_id}", response_model=APIResponse)
async def initiate_conversation(patient_id: str, returning: bool = False):
    """
    Trigger onboarding message for a new patient, or a re-engagement
    message for a returning patient.
    """
    patient = await _get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    phone = patient.get("phone", "")
    name = patient.get("name", "Patient")
    if not phone:
        raise HTTPException(status_code=400, detail="Patient has no phone number")

    if returning:
        msg = welcome_returning(name)
        event = "patient.returning"
    else:
        msg = welcome_new_patient(name, FRONTEND_URL)
        event = "patient.created"

    success = send_whatsapp(phone, msg)
    await _log(patient_id, "onboarding", msg)
    await publish(event, {"patient_id": patient_id, "patient_name": name})

    return APIResponse(
        success=success,
        data={"phone": phone, "event_published": event},
        message=f"{'Returning' if returning else 'Welcome'} message sent to {name}",
    )


@router.get("/sessions", response_model=APIResponse)
async def get_sessions(limit: int = 30):
    """Fetch recent message sessions."""
    cursor = db.message_sessions.find({}).sort("last_message_ts", -1).limit(limit)
    sessions = await cursor.to_list(length=limit)
    return APIResponse(
        success=True,
        data=[_serialize(s) for s in sessions],
        message=f"Fetched {len(sessions)} sessions",
    )


@router.get("/sessions/{patient_id}", response_model=APIResponse)
async def get_patient_session(patient_id: str):
    """Fetch message session for a specific patient."""
    session = await db.message_sessions.find_one({"patient_id": patient_id, "channel": "whatsapp"})
    if not session:
        return APIResponse(success=True, data=None, message="No session found")
    return APIResponse(success=True, data=_serialize(session), message="Session fetched")
