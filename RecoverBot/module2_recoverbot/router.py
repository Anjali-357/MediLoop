"""
module2_recoverbot/router.py
FastAPI router for all RecoverBot endpoints.
Mounted in main.py with prefix='/api/recoverbot'.
"""
from __future__ import annotations
import asyncio
import json
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import JSONResponse

from shared.auth import get_current_user
from shared.database import db
from shared.models import APIResponse
from .services import followup_service

router = APIRouter()


# ─── WebSocket Alert Manager ─────────────────────────────────────────────────

class AlertManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, payload: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = AlertManager()
followup_service.ws_manager = ws_manager  # inject into service layer


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@router.post("/start", response_model=APIResponse)
async def manual_start_followup(
    patient_id: str,
    consultation_id: str,
    _user: dict = Depends(get_current_user),
):
    """Manually trigger follow-up for a patient (also auto-triggered by event)."""
    followup_id = await followup_service.create_followup(patient_id, consultation_id)
    return APIResponse(
        success=True,
        data={"followup_id": followup_id},
        message="Follow-up started and check-ins scheduled",
    )


async def _attach_patient_names(docs: list[dict]) -> list[dict]:
    if not docs:
        return docs
    patient_ids = {doc["patient_id"] for doc in docs if doc.get("patient_id")}
    from bson.errors import InvalidId
    object_ids = []
    for pid in patient_ids:
        try:
            object_ids.append(ObjectId(pid))
        except InvalidId:
            pass
    patients_cursor = db.patients.find({"_id": {"$in": object_ids}})
    name_map = {}
    async for p in patients_cursor:
        name_map[str(p["_id"])] = p.get("name", "Unknown Patient")
    for doc in docs:
        doc["patient_name"] = name_map.get(doc.get("patient_id"), "Unknown Patient")
    return docs


@router.get("/followups/{patient_id}", response_model=APIResponse)
async def get_followups(
    patient_id: str,
    _user: dict = Depends(get_current_user),
):
    """Return all followup documents for a given patient."""
    cursor = db.followups.find({"patient_id": patient_id}).sort("created_at", -1)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    docs = await _attach_patient_names(docs)
    return APIResponse(success=True, data=docs, message=f"{len(docs)} followup(s) found")


@router.get("/followups", response_model=APIResponse)
async def get_all_followups(
    _user: dict = Depends(get_current_user),
):
    """Return ALL followup documents — used by the dashboard with no patient filter."""
    cursor = db.followups.find({}).sort("created_at", -1)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    docs = await _attach_patient_names(docs)
    return APIResponse(success=True, data=docs, message=f"{len(docs)} followup(s) found")


@router.get("/risk-flagged", response_model=APIResponse)
async def get_risk_flagged(
    _user: dict = Depends(get_current_user),
):
    """List all HIGH / CRITICAL patients for the doctor dashboard."""
    cursor = db.followups.find(
        {"risk_label": {"$in": ["HIGH", "CRITICAL"]}}
    ).sort("created_at", -1)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    docs = await _attach_patient_names(docs)
    return APIResponse(success=True, data=docs, message=f"{len(docs)} flagged patient(s)")


@router.post("/webhook/twilio")
async def twilio_webhook(
    From: str = Form(...),
    Body: str = Form(...),
):
    """
    Twilio posts here when a patient replies on WhatsApp.
    From format: whatsapp:+919876543210
    """
    phone_raw = From.replace("whatsapp:", "").strip()

    # Look up patient by phone
    patient = await db.patients.find_one({"phone": phone_raw})
    if not patient:
        # Try alternate formatting
        patient = await db.patients.find_one({"phone": From})

    if not patient:
        # Unknown number — do nothing
        return JSONResponse(content={"status": "unknown_patient"})

    patient_id = str(patient["_id"])
    updated_followup = await followup_service.process_patient_reply(patient_id, Body.strip())
    return JSONResponse(content={"status": "ok", "risk_label": updated_followup.get("risk_label", "UNKNOWN")})


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/alerts")
async def websocket_alerts(ws: WebSocket):
    """
    Real-time alert stream for the doctor dashboard.
    Clients connect here; they receive JSON alerts when patients are flagged.
    No JWT for WebSocket simplicity — add token query param check if needed.
    """
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep connection alive; server pushes data
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
