"""
module6_commhub/router.py
FastAPI router for CommHub — manual send, initiate, session log, and UNIFIED Twilio webhook.
"""
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import Response as FastAPIResponse
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


# ── Unmapped Queue Endpoints ───────────────────────────────────────────────

@router.get("/unmapped", response_model=APIResponse)
async def get_unmapped_messages():
    """Fetch unmapped messages for manual review."""
    cursor = db.unmapped_messages.find({"status": "pending"}).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    return APIResponse(success=True, data=[_serialize_appt(d) for d in docs], message=f"Fetched {len(docs)} unmapped messages")

@router.patch("/unmapped/{msg_id}/resolve", response_model=APIResponse)
async def resolve_unmapped_message(msg_id: str):
    """Mark an unmapped message as resolved."""
    result = await db.unmapped_messages.update_one(
        {"_id": ObjectId(msg_id)},
        {"$set": {"status": "resolved"}},
    )
    return APIResponse(success=result.modified_count > 0, data=None, message="Resolved" if result.modified_count else "Not found")


# ── Appointment Request Endpoints ────────────────────────────────────────────

def _serialize_appt(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.get("/appointments", response_model=APIResponse)
async def get_appointments(status: str = "pending"):
    """Fetch appointment requests for the Control Center."""
    cursor = db.appointment_requests.find({"status": status}).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    return APIResponse(success=True, data=[_serialize_appt(d) for d in docs], message=f"{len(docs)} appointment requests")


@router.patch("/appointments/{appt_id}/dismiss", response_model=APIResponse)
async def dismiss_appointment(appt_id: str):
    """Mark an appointment request as dismissed."""
    result = await db.appointment_requests.update_one(
        {"_id": ObjectId(appt_id)},
        {"$set": {"status": "dismissed"}},
    )
    return APIResponse(success=result.modified_count > 0, data=None, message="Dismissed" if result.modified_count else "Not found")


# ── Unified Twilio Webhook ────────────────────────────────────────────────────
# Configure your Twilio number/sandbox webhook to:
#   POST https://<your-backend-host>/api/commhub/webhook/twilio
#
# This is the single entry point for ALL incoming patient WhatsApp messages.
# It routes through the Orchestrator AI regardless of whether the patient has
# an active RecoverBot followup — fixing the "silent reply" bug.

@router.post("/webhook/twilio")
async def twilio_inbound(
    From: str = Form(...),
    Body: str = Form(...),
):
    """
    Twilio posts here on every incoming WhatsApp message.
    Routes through Orchestrator → Gemini reply or module activation.
    """
    import google.generativeai as genai
    from module5_orchestrator.intent_classifier import classify_intent, INTENT_TO_MODULE
    from module5_orchestrator.decision_engine import store_decision, execute_decision

    phone_raw = From.replace("whatsapp:", "").strip()
    message   = Body.strip()
    now       = datetime.now(timezone.utc)

    # ── 1. Find patient by phone ──────────────────────────────────────────────
    patient = (
        await db.patients.find_one({"phone": phone_raw}) or
        await db.patients.find_one({"phone": From}) or
        await db.patients.find_one({"phone": {"$regex": phone_raw.lstrip("+"), "$options": "i"}})
    )
    if not patient:
        send_whatsapp(
            phone_raw,
            "Hi! We don't have your number in our system yet. "
            "Please ask your doctor to register you in MediLoop. 🏥"
        )
        return FastAPIResponse(content="<Response/>", media_type="application/xml")

    patient_id   = str(patient["_id"])
    patient_name = patient.get("name", "Patient")

    # ── 2. Log inbound message ────────────────────────────────────────────────
    await db.message_sessions.update_one(
        {"patient_id": patient_id, "channel": "whatsapp"},
        {
            "$set":        {"last_message_ts": now, "conversation_state": "active"},
            "$push":       {"messages": {"direction": "inbound", "module": "patient", "body": message[:500], "ts": now}},
            "$setOnInsert": {"patient_id": patient_id, "channel": "whatsapp"},
        },
        upsert=True,
    )
    print(f"[CommHub] Inbound from {patient_name} ({phone_raw}): {message[:80]}")

    # ── 3. Classify intent ────────────────────────────────────────────────────
    try:
        followup    = await db.followups.find_one({"patient_id": patient_id, "status": "active"})
        recent_hist = (followup or {}).get("conversation_log", [])[-4:]
        consult     = await db.consultations.find_one({"patient_id": patient_id}, sort=[("created_at", -1)])
        diagnosis   = (
            (consult or {}).get("diagnosis") or
            ", ".join(patient.get("chronic_conditions", [])) or
            "general health"
        )

        classification = await classify_intent(
            message=message,
            patient_name=patient_name,
            diagnosis=diagnosis,
            recent_history=recent_hist,
            is_pediatric=patient.get("is_pediatric", False),
            age=patient.get("age", 0),
        )
        intent     = classification.get("intent", "GENERAL_QUERY")
        confidence = classification.get("confidence", 0.0)
        suggested  = INTENT_TO_MODULE.get(intent, "chatbot")

        await store_decision(
            patient_id=patient_id,
            intent=intent,
            confidence=confidence,
            reasoning=classification.get("reasoning", ""),
            suggested_module=suggested,
            trigger_source="whatsapp_inbound",
        )

        # ── 4. Generate appropriate reply ─────────────────────────────────────
        if confidence < 0.75 or intent == "EMERGENCY":
            reply = (
                f"Hi {patient_name}, your message has been received by your care team "
                "and a doctor will get back to you shortly."
            )
            # Route to unmapped queue for manual review in Control Center
            await db.unmapped_messages.insert_one({
                "patient_id": patient_id,
                "patient_name": patient_name,
                "phone": phone_raw,
                "message": message,
                "intent": intent,
                "confidence": confidence,
                "status": "pending",
                "created_at": now
            })
            generate_gemini = False

        elif intent in ("PAIN", "FOLLOWUP", "CARE_GAP"):
            # Activate module silently in the background
            import asyncio
            asyncio.create_task(execute_decision(
                patient_id=patient_id, intent=intent,
                patient=patient, message=message, suggested_module=suggested,
            ))
            generate_gemini = True

        elif intent == "APPOINTMENT_REQUEST":
            # Log appointment request for doctor to see in Control Center
            await db.appointment_requests.insert_one({
                "patient_id":   patient_id,
                "patient_name": patient_name,
                "phone":        phone_raw,
                "message":      message,
                "status":       "pending",
                "created_at":   now,
            })
            await publish("appointment.requested", {
                "patient_id":   patient_id,
                "patient_name": patient_name,
                "message":      message,
            })
            reply = (
                f"Hi {patient_name}, your appointment request has been noted! "
                "Your doctor's team will contact you shortly to confirm a time. 🗓️"
            )
            generate_gemini = False

        else:
            # GENERAL_QUERY
            generate_gemini = True

        # Generate contextual Gemini reply for PAIN, FOLLOWUP, CARE_GAP, and GENERAL_QUERY
        if generate_gemini:
            genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
            model = genai.GenerativeModel("gemini-2.5-flash")
            hist_text = "\n".join(
                f"{h.get('role', '?').upper()}: {h.get('message', '')}"
                for h in recent_hist
            )
            # Incorporate recent consultation context
            consult_context = ""
            if consult and "soap_note" in consult:
                assessment = consult["soap_note"].get("assessment", "")
                plan = consult["soap_note"].get("plan", "")
                if assessment or plan:
                    consult_context = f"Recent Consultation Context:\nAssessment: {assessment}\nPlan: {plan}\n"

            prompt = (
                f"You are MediLoop, a friendly medical care assistant monitoring the patient's recovery.\n"
                f"Patient: {patient_name}"
                + (f", condition: {diagnosis}" if diagnosis and diagnosis != "general health" else "")
                + ".\n"
                + consult_context
                + (f"\nRecent chat:\n{hist_text}\n" if hist_text else "")
                + f"\nPatient says: {message}\n\n"
                "Reply warmly and empathetically in 1-2 clear sentences. "
                "Since they are expressing a concern, explicitly ask them how their recovery is going regarding their recent consultation, or ask them to rate any pain from 0-10. "
                "Do not be repetitive if they already answered. No bullet points. No markdown."
            )
            resp  = await model.generate_content_async(prompt)
            reply = resp.text.strip()

        # ── 5. Send reply ─────────────────────────────────────────────────────
        send_whatsapp(phone_raw, reply)
        await _log(patient_id, suggested, reply)
        print(f"[CommHub] Reply to {patient_name}: {reply[:80]}")

        # Mirror into RecoverBot conversation log if followup is active
        if followup:
            await db.followups.update_one(
                {"_id": followup["_id"]},
                {"$push": {"conversation_log": {"$each": [
                    {"timestamp": now, "role": "patient", "message": message},
                    {"timestamp": now, "role": "bot",     "message": reply},
                ]}}},
            )

    except Exception as exc:
        print(f"[CommHub Webhook] Error: {exc}")
        # Failsafe — never leave a patient with silence
        fallback = (
            f"Hi {patient_name}, your message was received. "
            "Your care team will be in touch shortly. 💙"
        )
        send_whatsapp(phone_raw, fallback)
        await _log(patient_id, "fallback", fallback)

    # Twilio expects TwiML (empty is fine — we already replied via REST API)
    return FastAPIResponse(content="<Response/>", media_type="application/xml")
