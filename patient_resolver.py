"""
patient_resolver.py
Thin integration service — NOT a module router.
Resolves existing patients by phone or creates new minimal patient records.
Publishes: patient.created, patient.returning, patient.mapped
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from shared.database import db
from shared.models import APIResponse
from shared.events import publish

router = APIRouter()


class ResolveRequest(BaseModel):
    name: str
    phone: str
    doctor_id: Optional[str] = None


def _normalize_phone(phone: str) -> str:
    """Normalize to E.164-ish: keep digits + leading +"""
    phone = phone.strip()
    if not phone.startswith("+"):
        phone = "+" + phone.lstrip("0")
    return phone


@router.post("/resolve", response_model=APIResponse)
async def resolve_patient(req: ResolveRequest):
    """
    Step 1: lookup by phone.
    Step 2A: existing — update last_active_at, publish patient.returning.
    Step 2B: new     — insert minimal record, publish patient.created + patient.mapped.
    """
    phone = _normalize_phone(req.phone)
    now = datetime.now(timezone.utc)

    # ── Step 1: lookup ──────────────────────────────────────────────────────
    existing = await db.patients.find_one({"phone": {"$regex": phone.replace("+", "\\+"), "$options": "i"}})

    if existing:
        # ── Step 2A: returning patient ──────────────────────────────────────
        patient_id = str(existing["_id"])
        await db.patients.update_one(
            {"_id": existing["_id"]},
            {"$set": {"last_active_at": now}}
        )
        await publish("patient.returning", {
            "patient_id": patient_id,
            "patient_name": existing.get("name", req.name),
            "phone": phone,
            "source": "hospital_resolve",
        })
        return APIResponse(
            success=True,
            data={
                "patient_id": patient_id,
                "status": "existing",
                "name": existing.get("name", req.name),
                "phone": phone,
                "age": existing.get("age"),
                "chronic_conditions": existing.get("chronic_conditions", []),
                "last_active_at": now.isoformat(),
            },
            message=f"Returning patient resolved: {existing.get('name', req.name)}",
        )

    # ── Step 2B: new patient ─────────────────────────────────────────────
    doc = {
        "name": req.name,
        "phone": phone,
        "doctor_id": req.doctor_id or "",
        "onboarding_status": "clinic_created",
        "source": "hospital",
        "last_active_at": now,
        "chronic_conditions": [],
        "created_at": now,
    }
    result = await db.patients.insert_one(doc)
    patient_id = str(result.inserted_id)

    await publish("patient.created", {
        "patient_id": patient_id,
        "patient_name": req.name,
        "phone": phone,
        "source": "hospital_resolve",
    })
    await publish("patient.mapped", {
        "patient_id": patient_id,
        "doctor_id": req.doctor_id or "",
        "source": "hospital_resolve",
    })

    return APIResponse(
        success=True,
        data={
            "patient_id": patient_id,
            "status": "created",
            "name": req.name,
            "phone": phone,
            "age": None,
            "chronic_conditions": [],
        },
        message=f"New patient created: {req.name}",
    )


@router.get("/context/{patient_id}", response_model=APIResponse)
async def get_patient_context(patient_id: str):
    """
    Aggregates intelligence for a patient before consultation:
    - recent consultations (with summary_short)
    - followup risk status
    - latest pain score
    - pending care gaps count
    """
    from bson import ObjectId
    from datetime import datetime

    timeline = []

    # 1. Consultations
    cursor = db.consultations.find({"patient_id": patient_id}).sort("created_at", -1).limit(10)
    consultations = []
    async for doc in cursor:
        dt = doc.get("created_at")
        ts = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        c_obj = {
            "id": str(doc["_id"]),
            "created_at": ts,
            "status": doc.get("status", ""),
            "summary_short": doc.get("summary_short", ""),
            "soap_note": doc.get("soap_note", {}),
        }
        consultations.append(c_obj)
        timeline.append({"type": "consultation", "timestamp": ts, "data": c_obj})

    # 2. Pain Scores
    pain_cursor = db.pain_scores.find({"patient_id": patient_id}).sort("created_at", -1).limit(10)
    async for pk in pain_cursor:
        dt = pk.get("created_at")
        ts = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        timeline.append({
            "type": "pain_score",
            "timestamp": ts,
            "data": {"score": pk.get("score")}
        })
        
    latest_pain_score = None
    if timeline and any(t["type"] == "pain_score" for t in timeline):
        latest_pain_score = next(t["data"]["score"] for t in timeline if t["type"] == "pain_score")

    # 3. Followup Activity
    followup = await db.followups.find_one({"patient_id": patient_id}, sort=[("created_at", -1)])
    risk_status = followup.get("risk_label", "UNKNOWN") if followup else "UNKNOWN"
    risk_score = followup.get("risk_score", 0.0) if followup else 0.0
    
    if followup and "conversation_log" in followup:
        for msg in followup["conversation_log"][-5:]:  # Last 5 messages
            if msg.get("role") == "patient":
                dt = msg.get("timestamp")
                ts = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
                timeline.append({
                    "type": "patient_message",
                    "timestamp": ts,
                    "data": {"message": msg.get("message")}
                })

    # 4. Care Gaps
    gaps_cursor = db.care_gaps.find({"patient_id": patient_id}).sort("created_at", -1).limit(10)
    pending_gaps = 0
    async for gap in gaps_cursor:
        if gap.get("status") == "pending":
            pending_gaps += 1
        dt = gap.get("created_at")
        ts = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        timeline.append({
            "type": "care_gap",
            "timestamp": ts,
            "data": {"gap_type": gap.get("gap_type"), "status": gap.get("status")}
        })

    # Sort timeline entirely
    timeline.sort(key=lambda x: x["timestamp"], reverse=True)

    return APIResponse(
        success=True,
        data={
            "patient_id": patient_id,
            "recent_consultations": consultations,
            "timeline": timeline,
            "risk_status": risk_status,
            "risk_score": risk_score,
            "latest_pain_score": latest_pain_score,
            "pending_gaps": pending_gaps,
        },
        message="Context aggregated",
    )
