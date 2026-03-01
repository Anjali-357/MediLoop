"""
module6_commhub/event_listener.py
Subscribes to Redis events from all modules and dispatches WhatsApp messages via gateway.
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from shared.database import db
from shared.events import subscribe, publish
from module6_commhub.gateway import send_whatsapp
import google.generativeai as genai
from module6_commhub.message_templates import (
    welcome_new_patient,
    welcome_returning,
    followup_flagged,
    painscan_link,
    recoverbot_prompt,
    caregap_outreach,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_patient(patient_id: str) -> dict | None:
    try:
        return await db.patients.find_one({"_id": ObjectId(patient_id)})
    except Exception:
        return await db.patients.find_one({"_id": patient_id})


async def _log_session(patient_id: str, channel: str, active_module: str,
                        message: str, direction: str = "outbound"):
    now = datetime.now(timezone.utc)
    await db.message_sessions.update_one(
        {"patient_id": patient_id, "channel": channel},
        {
            "$set": {"active_module": active_module, "last_message_ts": now},
            "$push": {"messages": {"direction": direction, "module": active_module, "body": message[:500], "ts": now}},
            "$setOnInsert": {"patient_id": patient_id, "channel": channel, "conversation_state": "active"},
        },
        upsert=True,
    )


# ── conversational ai helper ──────────────────────────────────────────────────

async def _generate_conversational_outreach(patient_name: str, patient_id: str, topic: str) -> str:
    """Generates a contextual AI outreach message for adults."""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    # Fetch latest consultation
    consult = await db.consultations.find_one({"patient_id": str(patient_id)}, sort=[("created_at", -1)])
    
    context_str = ""
    if consult and "soap_note" in consult:
        assessment = consult["soap_note"].get("assessment", "")
        plan = consult["soap_note"].get("plan", "")
        if assessment or plan:
            context_str = f"\nRecent Consultation Context:\nAssessment: {assessment}\nPlan: {plan}\n"
            
    topic_instructions = {
        "pain": "Gently check in on their pain levels and ask them to rate any current pain from 0-10.",
        "recovery": "Gently check in on their overall recovery progress and how they are feeling today.",
        "caregap": "Gently remind them that they have an upcoming care milestone or checkup they should schedule."
    }
    instruction = topic_instructions.get(topic, "Gently check in on their health.")

    prompt = (
        f"You are MediLoop, a friendly medical care assistant proactively initiating a conversation with a patient.\n"
        f"Patient: {patient_name}"
        + context_str +
        f"\nGoal: {instruction}\n"
        "Draft a warm, empathetic 1-2 sentence outreach message to send to the patient on WhatsApp. "
        "Do NOT include any external links. Do not use bullet points or markdown. "
        "Make it sound like a natural text message conversation starter from their care team."
    )
    resp = await model.generate_content_async(prompt)
    return resp.text.strip()


# ── Event Handlers ────────────────────────────────────────────────────────────

async def on_patient_created():
    """Phase 3: Brief care intro, not a generic welcome menu."""
    async for event in subscribe("patient.created"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]

            # ── Dedup guard: skip if message was already sent in last 5 min ──
            existing_session = await db.message_sessions.find_one({"patient_id": event.get("patient_id"), "channel": "whatsapp"})
            if existing_session:
                last_ts = existing_session.get("last_message_ts")
                if last_ts and (datetime.now(timezone.utc) - last_ts).total_seconds() < 300:
                    print(f"[CommHub] Skipping duplicate care intro for {name} (sent < 5min ago)")
                    continue

            msg = welcome_new_patient(name, FRONTEND_URL)
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "onboarding", msg)
            print(f"[CommHub] Care intro \u2192 {name}")
        except Exception as e:
            print(f"[CommHub] on_patient_created error: {e}")


async def on_patient_returning():
    async for event in subscribe("patient.returning"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            msg = welcome_returning(name)
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "returning", msg)
        except Exception as e:
            print(f"[CommHub] on_patient_returning error: {e}")


async def on_patient_discharged():
    """Phase 3: Natural recovery check-in after discharge."""
    async for event in subscribe("patient.discharged"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            msg = (f"Hi {name}, just checking in after your visit today. "
                   "How are you feeling? Reply with any symptoms or questions — "
                   "your care team will guide you. 💙")
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "discharge_followup", msg)
            print(f"[CommHub] Discharge check → {name}")
        except Exception as e:
            print(f"[CommHub] on_patient_discharged error: {e}")


async def on_followup_flagged():
    async for event in subscribe("followup.flagged"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            risk_label = event.get("risk_label", "HIGH")
            msg = followup_flagged(name, risk_label)
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "recoverbot", msg)
            print(f"[CommHub] Followup alert → {name} | {risk_label}")
        except Exception as e:
            print(f"[CommHub] on_followup_flagged error: {e}")


async def on_painscan_requested():
    async for event in subscribe("painscan.requested"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            is_pediatric = patient.get("is_pediatric", False)
            
            if is_pediatric:
                link = f"{FRONTEND_URL.rstrip('/')}/painscan"
                msg = painscan_link(name, link, is_caregiver=True)
            else:
                msg = await _generate_conversational_outreach(name, str(patient.get("_id")), "pain")

            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "painscan", msg)
            print(f"[CommHub] PainScan outreach → {name}")
        except Exception as e:
            print(f"[CommHub] on_painscan_requested error: {e}")


async def on_recoverbot_requested():
    async for event in subscribe("recoverbot.requested"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            is_pediatric = patient.get("is_pediatric", False)
            
            if is_pediatric:
                msg = recoverbot_prompt(name, f"{FRONTEND_URL.rstrip('/')}/recoverbot")
            else:
                msg = await _generate_conversational_outreach(name, str(patient.get("_id")), "recovery")
                
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "recoverbot", msg)
            print(f"[CommHub] RecoverBot outreach → {name}")
        except Exception as e:
            print(f"[CommHub] on_recoverbot_requested error: {e}")


async def on_caregap_scan_requested():
    async for event in subscribe("caregap.scan_requested"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            is_pediatric = patient.get("is_pediatric", False)
            
            if is_pediatric:
                msg = caregap_outreach(name, "CARE_REMINDER")
            else:
                msg = await _generate_conversational_outreach(name, str(patient.get("_id")), "caregap")
                
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "caregap", msg)
            print(f"[CommHub] CareGap outreach → {name}")
        except Exception as e:
            print(f"[CommHub] on_caregap_scan_requested error: {e}")


async def on_patient_unresponsive():
    """Phase 9: Gentle nudge + trigger CareGap scan."""
    async for event in subscribe("patient.unresponsive"):
        try:
            patient = await _get_patient(event.get("patient_id"))
            if not patient or not patient.get("phone"):
                continue
            name, phone = patient.get("name", "Patient"), patient["phone"]
            msg = (f"Hi {name}, we haven't heard from you in a while. "
                   "Just checking in — how are you doing? Your care team is here. 💙")
            send_whatsapp(phone, msg)
            await _log_session(event["patient_id"], "whatsapp", "unresponsive_nudge", msg)
            await publish("caregap.scan_requested", {"patient_id": event["patient_id"], "source": "unresponsive"})
            print(f"[CommHub] Unresponsive nudge → {name}")
        except Exception as e:
            print(f"[CommHub] on_patient_unresponsive error: {e}")


# ── Phase 9: Scheduled check ──────────────────────────────────────────────────

async def check_unresponsive_patients():
    threshold = datetime.now(timezone.utc) - timedelta(hours=48)
    cursor = db.message_sessions.find({
        "channel": "whatsapp",
        "conversation_state": "active",
        "last_message_ts": {"$lt": threshold},
    })
    async for s in cursor:
        pid = s.get("patient_id")
        if pid:
            await publish("patient.unresponsive", {"patient_id": pid, "source": "scheduled_check"})
            print(f"[CommHub] Scheduled unresponsive: {pid}")


# ── Startup ───────────────────────────────────────────────────────────────────

async def start_listeners():
    print("[CommHub] Starting event listeners...")
    asyncio.create_task(on_patient_created())
    asyncio.create_task(on_patient_returning())
    asyncio.create_task(on_patient_discharged())
    asyncio.create_task(on_followup_flagged())
    asyncio.create_task(on_painscan_requested())
    asyncio.create_task(on_recoverbot_requested())
    asyncio.create_task(on_caregap_scan_requested())
    asyncio.create_task(on_patient_unresponsive())

    scheduler = AsyncIOScheduler()
    scheduler.add_job(check_unresponsive_patients, "interval", hours=6, id="unresponsive_check")
    scheduler.start()
    print("[CommHub] ✅ 8 event listeners + unresponsive scheduler active")
