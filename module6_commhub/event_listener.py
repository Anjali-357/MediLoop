"""
module6_commhub/event_listener.py
Subscribes to Redis events from all modules and dispatches WhatsApp messages via gateway.
This is the beating heart of CommHub.
"""
import asyncio
import os
from datetime import datetime, timezone

from bson import ObjectId

from shared.database import db
from shared.events import subscribe
from module6_commhub.gateway import send_whatsapp, send_with_link
from module6_commhub.message_templates import (
    welcome_new_patient,
    welcome_returning,
    followup_flagged,
    painscan_link,
    recoverbot_prompt,
    caregap_outreach,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")


async def _get_patient(patient_id: str) -> dict | None:
    try:
        return await db.patients.find_one({"_id": ObjectId(patient_id)})
    except Exception:
        return await db.patients.find_one({"_id": patient_id})


async def _log_session(patient_id: str, channel: str, active_module: str,
                        message: str, direction: str = "outbound"):
    """Upsert a message_sessions record and append to message log."""
    now = datetime.now(timezone.utc)
    await db.message_sessions.update_one(
        {"patient_id": patient_id, "channel": channel},
        {
            "$set": {
                "active_module": active_module,
                "last_message_ts": now,
            },
            "$push": {
                "messages": {
                    "direction": direction,
                    "module": active_module,
                    "body": message[:500],
                    "ts": now,
                }
            },
            "$setOnInsert": {
                "patient_id": patient_id,
                "channel": channel,
                "conversation_state": "active",
            }
        },
        upsert=True,
    )


# ── Event Handlers ────────────────────────────────────────────────────────────

async def on_patient_created():
    async for event in subscribe("patient.created"):
        try:
            patient_id = event.get("patient_id")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            msg = welcome_new_patient(name, FRONTEND_URL)
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "onboarding", msg)
            print(f"[CommHub] Welcome sent → {name} ({phone})")
        except Exception as e:
            print(f"[CommHub] on_patient_created error: {e}")


async def on_patient_returning():
    async for event in subscribe("patient.returning"):
        try:
            patient_id = event.get("patient_id")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            from module6_commhub.message_templates import welcome_returning
            msg = welcome_returning(name)
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "returning", msg)
        except Exception as e:
            print(f"[CommHub] on_patient_returning error: {e}")


async def on_followup_flagged():
    async for event in subscribe("followup.flagged"):
        try:
            patient_id = event.get("patient_id")
            risk_label = event.get("risk_label", "HIGH")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            msg = followup_flagged(name, risk_label)
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "recoverbot", msg)
            print(f"[CommHub] Followup alert → {name} | risk: {risk_label}")
        except Exception as e:
            print(f"[CommHub] on_followup_flagged error: {e}")


async def on_painscan_requested():
    async for event in subscribe("painscan.requested"):
        try:
            patient_id = event.get("patient_id")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            link = f"{FRONTEND_URL.rstrip('/')}/painscan"
            is_peds = patient.get("is_pediatric", False)
            msg = painscan_link(name, link, is_caregiver=is_peds)
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "painscan", msg)
            print(f"[CommHub] PainScan link → {name} ({phone})")
        except Exception as e:
            print(f"[CommHub] on_painscan_requested error: {e}")


async def on_recoverbot_requested():
    async for event in subscribe("recoverbot.requested"):
        try:
            patient_id = event.get("patient_id")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            link = f"{FRONTEND_URL.rstrip('/')}/recoverbot"
            msg = recoverbot_prompt(name, link)
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "recoverbot", msg)
            print(f"[CommHub] RecoverBot prompt → {name} ({phone})")
        except Exception as e:
            print(f"[CommHub] on_recoverbot_requested error: {e}")


async def on_caregap_scan_requested():
    async for event in subscribe("caregap.scan_requested"):
        try:
            patient_id = event.get("patient_id")
            patient = await _get_patient(patient_id)
            if not patient:
                continue
            phone = patient.get("phone", "")
            name = patient.get("name", "Patient")
            if not phone:
                continue
            msg = caregap_outreach(name, "CARE_REMINDER")
            send_whatsapp(phone, msg)
            await _log_session(patient_id, "whatsapp", "caregap", msg)
        except Exception as e:
            print(f"[CommHub] on_caregap_scan_requested error: {e}")


# ── Startup ───────────────────────────────────────────────────────────────────

async def start_listeners():
    """Start all CommHub event listeners as background tasks."""
    print("[CommHub] Starting event listeners...")
    asyncio.create_task(on_patient_created())
    asyncio.create_task(on_patient_returning())
    asyncio.create_task(on_followup_flagged())
    asyncio.create_task(on_painscan_requested())
    asyncio.create_task(on_recoverbot_requested())
    asyncio.create_task(on_caregap_scan_requested())
    print("[CommHub] ✅ All 6 event listeners active")
