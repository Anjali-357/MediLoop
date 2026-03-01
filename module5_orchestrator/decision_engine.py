"""
module5_orchestrator/decision_engine.py
Routes classified intent to the appropriate module action via Redis events or direct action.
"""
import os
from datetime import datetime, timezone
from shared.database import db
from shared.events import publish
from module6_commhub.gateway import send_whatsapp

DOCTOR_PHONE = os.getenv("DOCTOR_PHONE", os.getenv("TWILIO_PHONE_NUMBER", ""))


async def store_decision(patient_id: str, intent: str, confidence: float,
                          reasoning: str, suggested_module: str,
                          trigger_source: str = "whatsapp") -> str:
    """Persist AI decision to ai_decisions collection."""
    doc = {
        "patient_id": patient_id,
        "intent": intent,
        "confidence": confidence,
        "reasoning": reasoning,
        "suggested_module": suggested_module,
        "trigger_source": trigger_source,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.ai_decisions.insert_one(doc)
    return str(result.inserted_id)


async def execute_decision(patient_id: str, intent: str, patient: dict,
                            message: str, suggested_module: str) -> dict:
    """Execute the routing decision for a given intent."""
    phone = patient.get("phone", "")
    name = patient.get("name", "Patient")
    is_pediatric = patient.get("is_pediatric", False)
    age = patient.get("age", 99)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5174").rstrip("/")
    painscan_link = f"{frontend_url}/painscan"
    action_taken = ""

    # Safety guard: redirect adult PAIN to FOLLOWUP
    if intent == "PAIN" and not (is_pediatric and age < 6):
        intent = "FOLLOWUP"
        suggested_module = "recoverbot"

    if intent == "PAIN":
        await publish("painscan.requested", {
            "patient_id": patient_id,
            "patient_name": name,
            "message": message,
            "source": "orchestrator",
        })
        if phone:
            send_whatsapp(phone,
                f"Hello, our system has detected that {name} may be in discomfort. "
                f"Please use the PainScan tool to help us assess their pain level:\n\n"
                f"🔗 {painscan_link}\n\n"
                "Open the link and follow the video-based pain assessment. "
                "A care team member will review the results immediately. 🩺")
        action_taken = f"Published painscan.requested event + sent PainScan link to caregiver"

    elif intent == "FOLLOWUP":
        await publish("recoverbot.requested", {
            "patient_id": patient_id,
            "patient_name": name,
            "message": message,
            "source": "orchestrator",
        })
        action_taken = "Published recoverbot.requested event"

    elif intent == "CARE_GAP":
        await publish("caregap.scan_requested", {
            "patient_id": patient_id,
            "source": "orchestrator",
        })
        # Trigger an immediate gap scan via the CareGap module
        try:
            from module4_caregap.scanner import scan_patient
            import asyncio
            asyncio.create_task(scan_patient(patient_id))
        except Exception as e:
            print(f"[orchestrator] CareGap scan error: {e}")
        action_taken = "Triggered CareGap scan for patient"

    elif intent == "GENERAL_QUERY":
        # Gemini chatbot fallback reply
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel("gemini-2.5-flash")
            resp = await model.generate_content_async(
                f"You are MediLoop, a friendly healthcare assistant. "
                f"Patient {name} asked: '{message}'. "
                f"Give a helpful, empathetic reply in under 100 words. Plain text only."
            )
            reply = resp.text.strip()
        except Exception:
            reply = f"Hi {name}, thank you for reaching out! A care team member will get back to you shortly."
        if phone:
            send_whatsapp(phone, reply)
        action_taken = f"Sent general chatbot reply"

    elif intent == "EMERGENCY":
        await publish("doctor.alert", {
            "patient_id": patient_id,
            "patient_name": name,
            "message": message,
            "severity": "CRITICAL",
            "source": "orchestrator",
        })
        # Immediate WhatsApp back to patient
        if phone:
            send_whatsapp(phone,
                f"🚨 {name}, this sounds urgent! We are alerting your care team immediately. "
                "If this is a medical emergency, please call 112 (emergency services) right now!")
        action_taken = "Published doctor.alert + notified patient of emergency"

    await publish("module.requested", {
        "patient_id": patient_id,
        "intent": intent,
        "module": suggested_module,
        "source": "orchestrator",
    })

    return {"action_taken": action_taken, "module": suggested_module}
