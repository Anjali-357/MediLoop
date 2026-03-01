import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from bson import ObjectId
from datetime import datetime, timezone
from shared.database import db
from shared.models import APIResponse, CareGapOut
from shared.events import publish
from module4_caregap.scanner import scan_patient, scan_all_patients
from module4_caregap.messaging import send_whatsapp_message
from pydantic import BaseModel
from typing import Optional

class ApproveBody(BaseModel):
    message: Optional[str] = None

router = APIRouter()

@router.post("/scan", response_model=APIResponse)
async def scan_gaps(background_tasks: BackgroundTasks, patient_id: Optional[str] = None):
    if patient_id:
        background_tasks.add_task(scan_patient, patient_id)
        msg = f"Scan started for patient {patient_id}"
    else:
        background_tasks.add_task(scan_all_patients)
        msg = "Full scan started"
    return APIResponse(success=True, data=None, message=msg)

@router.get("/pending", response_model=APIResponse)
async def get_pending_gaps():
    cursor = db.care_gaps.find({"status": "pending"}).sort("priority", 1)
    gaps = await cursor.to_list(length=100)
    return APIResponse(success=True, data=[CareGapOut(**g) for g in gaps], message="Fetched pending gaps")

@router.get("/gaps/{patient_id}", response_model=APIResponse)
async def get_patient_gaps(patient_id: str):
    cursor = db.care_gaps.find({"patient_id": patient_id}).sort("priority", 1)
    gaps = await cursor.to_list(length=100)
    return APIResponse(success=True, data=[CareGapOut(**g) for g in gaps], message=f"Fetched gaps for {patient_id}")

@router.post("/approve/{gap_id}", response_model=APIResponse)
async def approve_gap(gap_id: str, body: ApproveBody = None):
    gap = await db.care_gaps.find_one({"_id": ObjectId(gap_id)})
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")

    # Use edited message from frontend if provided, else fall back to stored draft
    outreach_msg = (body.message if body and body.message else None) or gap.get('outreach_msg', '')

    patient = await db.patients.find_one({"_id": ObjectId(gap.get('patient_id'))})

    if patient and patient.get('phone'):
        send_whatsapp_message(patient['phone'], outreach_msg)

    await db.care_gaps.update_one(
        {"_id": ObjectId(gap_id)},
        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc), "outreach_msg": outreach_msg}}
    )

    await publish("caregap.outreach_sent", {
        "patient_id": gap.get('patient_id'),
        "gap_type": gap.get('gap_type')
    })

    return APIResponse(success=True, data=None, message="Outreach approved and sent")

@router.post("/dismiss/{gap_id}", response_model=APIResponse)
async def dismiss_gap(gap_id: str):
    result = await db.care_gaps.update_one(
        {"_id": ObjectId(gap_id)}, 
        {"$set": {"status": "dismissed"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Gap not found")
    return APIResponse(success=True, data=None, message="Gap dismissed")

@router.get("/analytics", response_model=APIResponse)
async def get_analytics():
    pipeline = [
        {"$group": {"_id": {"gap_type": "$gap_type", "status": "$status"}, "count": {"$sum": 1}}}
    ]
    results = await db.care_gaps.aggregate(pipeline).to_list(length=None)
    
    stats = {}
    for r in results:
        gtype = r['_id']['gap_type']
        status = r['_id']['status']
        count = r['count']
        if gtype not in stats:
            stats[gtype] = {'pending': 0, 'sent': 0, 'dismissed': 0}
        stats[gtype][status] = count
        
    return APIResponse(success=True, data=stats, message="Analytics fetched")
