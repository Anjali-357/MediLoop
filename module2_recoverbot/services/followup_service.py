"""
module2_recoverbot/services/followup_service.py
Core business logic: create followups, process check-ins, score risk, send alerts.
"""
from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Any

from bson import ObjectId
from shared.database import db
from shared.events import publish
from .gemini_service import generate_opener, continue_conversation, extract_features
from .risk_service import score_risk
from .twilio_service import send_whatsapp
from .scheduler_service import schedule_checkins

# Manager to broadcast WebSocket alerts to connected doctors
# Populated by router.py
ws_manager: Any = None

SEVERITY_MAP = {"low": 1, "mild": 1, "moderate": 2, "medium": 2, "severe": 3, "high": 3}


def _parse_severity(diagnosis_text: str) -> int:
    text = diagnosis_text.lower()
    for key, val in SEVERITY_MAP.items():
        if key in text:
            return val
    return 2  # default medium


async def create_followup(patient_id: str, consultation_id: str) -> dict:
    """
    Called on receipt of patient.discharged Redis event.
    Creates followup doc and schedules check-ins.
    """
    # Fetch patient details for age / phone
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        # Fallback: minimal doc
        patient = {"name": "Patient", "age": 30, "phone": None, "is_pediatric": False}

    # Fetch consultation for diagnosis
    consultation = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    diagnosis = (consultation or {}).get("diagnosis", "recent medical procedure")

    is_pediatric = (patient.get("age", 30) or 30) < 12

    # Build slot placeholders
    now = datetime.utcnow()
    checkin_schedule_placeholder = []  # will be filled by scheduler

    followup_doc = {
        "patient_id": patient_id,
        "consultation_id": consultation_id,
        "status": "active",
        "risk_score": 0.0,
        "risk_label": "LOW",
        "conversation_log": [],
        "checkin_schedule": checkin_schedule_placeholder,
        "is_pediatric": is_pediatric,
        "created_at": now,
    }
    result = await db.followups.insert_one(followup_doc)
    followup_id = str(result.inserted_id)

    # Schedule APScheduler jobs
    slots = await schedule_checkins(patient_id, followup_id, _run_checkin)
    await db.followups.update_one(
        {"_id": result.inserted_id},
        {"$set": {"checkin_schedule": slots}},
    )

    # Send first message immediately if phone available
    phone = patient.get("phone")
    if phone:
        opener = await generate_opener(
            patient_name=patient.get("name", "there"),
            diagnosis=diagnosis,
            is_pediatric=is_pediatric,
        )
        try:
            send_whatsapp(phone, opener)
        except Exception as e:
            print(f"[followup_service] Twilio send failed: {e}")
        await db.followups.update_one(
            {"_id": result.inserted_id},
            {"$push": {"conversation_log": {
                "timestamp": datetime.utcnow(),
                "role": "bot",
                "message": opener,
            }}},
        )

    return followup_id


async def _run_checkin(patient_id: str, followup_id: str, slot_index: int):
    """APScheduler callback: send a check-in message at scheduled time."""
    followup = await db.followups.find_one({"_id": ObjectId(followup_id)})
    if not followup or followup.get("status") in ("completed",):
        return

    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    phone = (patient or {}).get("phone")
    diagnosis = ""
    if followup.get("consultation_id"):
        consult = await db.consultations.find_one({"_id": ObjectId(followup["consultation_id"])})
        diagnosis = (consult or {}).get("diagnosis", "")

    bot_msg = await generate_opener(
        patient_name=(patient or {}).get("name", "there"),
        diagnosis=diagnosis,
        is_pediatric=followup.get("is_pediatric", False),
    )

    if phone:
        try:
            send_whatsapp(phone, bot_msg)
        except Exception as e:
            print(f"[checkin] Twilio error: {e}")

    await db.followups.update_one(
        {"_id": ObjectId(followup_id)},
        {
            "$push": {"conversation_log": {
                "timestamp": datetime.utcnow(),
                "role": "bot",
                "message": bot_msg,
            }},
            "$set": {f"checkin_schedule.{slot_index}.status": "completed",
                     f"checkin_schedule.{slot_index}.completed_at": datetime.utcnow()},
        },
    )


async def process_patient_reply(patient_id: str, patient_message: str) -> dict:
    """
    Handles an incoming Twilio webhook reply:
    1. Fetches active followup
    2. Generates Gemini reply
    3. Extracts features → risk score
    4. Fires alert if HIGH/CRITICAL
    Returns updated followup.
    """
    followup = await db.followups.find_one({"patient_id": patient_id, "status": "active"})
    if not followup:
        return {"error": "No active followup found"}

    followup_id = followup["_id"]
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    age = (patient or {}).get("age", 30) or 30
    phone = (patient or {}).get("phone")

    consult = await db.consultations.find_one({"_id": ObjectId(followup["consultation_id"])}) if followup.get("consultation_id") else {}
    diagnosis = (consult or {}).get("diagnosis", "")

    # Append patient message
    await db.followups.update_one(
        {"_id": followup_id},
        {"$push": {"conversation_log": {
            "timestamp": datetime.utcnow(),
            "role": "patient",
            "message": patient_message,
        }}},
    )

    # Generate bot reply
    updated = await db.followups.find_one({"_id": followup_id})
    conv_log = updated.get("conversation_log", [])

    bot_reply = await continue_conversation(conv_log, patient_message, diagnosis)

    await db.followups.update_one(
        {"_id": followup_id},
        {"$push": {"conversation_log": {
            "timestamp": datetime.utcnow(),
            "role": "bot",
            "message": bot_reply,
        }}},
    )

    if phone:
        try:
            send_whatsapp(phone, bot_reply)
        except Exception as e:
            print(f"[process_reply] Twilio error: {e}")

    # Extract features and score risk
    created_at = followup["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    days_since = max(1, (datetime.utcnow() - created_at).days)
    features = await extract_features(conv_log, age, days_since)

    risk_score, risk_label = score_risk(
        pain_score=features.get("pain_score", 5),
        fever_present=features.get("fever_present", False),
        swelling=features.get("swelling", False),
        medication_adherent=features.get("medication_adherent", True),
        days_since_discharge=features.get("days_since_discharge", days_since),
        age=features.get("age", age),
        diagnosis_severity=features.get("diagnosis_severity", 2),
    )

    update_fields: dict = {"risk_score": risk_score, "risk_label": risk_label}

    if risk_label in ("HIGH", "CRITICAL"):
        update_fields["status"] = "flagged"
        # Redis event → Module 4 CareGap
        await publish("followup.flagged", {
            "patient_id": patient_id,
            "risk_score": risk_score,
            "risk_label": risk_label,
            "followup_id": str(followup_id),
        })
        # Doctor alert via Twilio (could be doctor's number from .env / DB)
        # Broadcast via WebSocket
        if ws_manager:
            await ws_manager.broadcast({
                "type": "RISK_ALERT",
                "patient_id": patient_id,
                "risk_score": risk_score,
                "risk_label": risk_label,
                "followup_id": str(followup_id),
            })

        # Pediatric hook → PainScan
        if followup.get("is_pediatric"):
            if ws_manager:
                await ws_manager.broadcast({
                    "type": "painscan.requested",
                    "patient_id": patient_id,
                    "followup_id": str(followup_id),
                })

    await db.followups.update_one({"_id": followup_id}, {"$set": update_fields})

    final = await db.followups.find_one({"_id": followup_id})
    final["_id"] = str(final["_id"])
    return final
