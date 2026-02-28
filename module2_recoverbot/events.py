"""
module2_recoverbot/events.py
Redis event handlers for Module 2.
Subscribed channels: patient.discharged
Published channels:  followup.flagged
"""
import asyncio
from shared.events import subscribe
from .services.followup_service import create_followup


async def handle_patient_discharged(payload: dict) -> None:
    """
    Triggered when Module 1 (ScribeAI) fires patient.discharged.
    payload: { patient_id: str, consultation_id: str }
    """
    patient_id = payload.get("patient_id")
    consultation_id = payload.get("consultation_id")
    if not patient_id or not consultation_id:
        print(f"[recoverbot:events] Invalid payload: {payload}")
        return
    print(f"[recoverbot:events] Received patient.discharged for patient_id={patient_id}")
    await create_followup(patient_id, consultation_id)


async def start_subscribers() -> None:
    """Start all background subscriber tasks. Called in @app.on_event('startup')."""
    async def _listener():
        async for payload in subscribe("patient.discharged"):
            await handle_patient_discharged(payload)
            
    asyncio.create_task(_listener())
    print("[recoverbot:events] Subscribed to patient.discharged")
