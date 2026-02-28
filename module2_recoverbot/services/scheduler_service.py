"""
module2_recoverbot/services/scheduler_service.py
APScheduler-based check-in scheduler.
Job IDs are stored in Redis so jobs can be cancelled if needed.
"""
from __future__ import annotations
import asyncio
import json
import os
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Offsets in hours from discharge time
CHECKIN_OFFSETS_HOURS = [6, 24, 48, 72, 24 * 7, 24 * 14]

scheduler = AsyncIOScheduler()


def start_scheduler():
    if not scheduler.running:
        scheduler.start()


async def _store_job_ids(patient_id: str, job_ids: list[str]) -> None:
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    await r.set(f"scheduler_jobs:{patient_id}", json.dumps(job_ids), ex=60 * 60 * 24 * 15)
    await r.aclose()


async def _get_job_ids(patient_id: str) -> list[str]:
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    raw = await r.get(f"scheduler_jobs:{patient_id}")
    await r.aclose()
    return json.loads(raw) if raw else []


async def schedule_checkins(patient_id: str, followup_id: str, checkin_callback) -> list[dict]:
    """
    Schedule 6 check-in jobs. Returns list of CheckinSlot dicts.
    checkin_callback(patient_id, followup_id, slot_index) is the async fn to call.
    """
    now = datetime.utcnow()
    slots = []
    job_ids = []

    for i, offset_h in enumerate(CHECKIN_OFFSETS_HOURS):
        run_at = now + timedelta(hours=offset_h)
        job_id = f"checkin_{patient_id}_{i}"

        scheduler.add_job(
            checkin_callback,
            "date",
            run_date=run_at,
            args=[patient_id, followup_id, i],
            id=job_id,
            replace_existing=True,
        )
        job_ids.append(job_id)
        slots.append({
            "scheduled_at": run_at.isoformat(),
            "completed_at": None,
            "status": "pending",
        })

    await _store_job_ids(patient_id, job_ids)
    return slots


async def cancel_checkins(patient_id: str) -> int:
    """Cancel all scheduled check-ins for a patient. Returns count cancelled."""
    job_ids = await _get_job_ids(patient_id)
    cancelled = 0
    for job_id in job_ids:
        job = scheduler.get_job(job_id)
        if job:
            job.remove()
            cancelled += 1
    return cancelled
