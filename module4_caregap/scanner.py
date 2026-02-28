import asyncio
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from shared.database import db
from shared.events import subscribe
from module4_caregap.ai import draft_outreach_message

scheduler = AsyncIOScheduler()

GAP_PRIORITY = {
    'DETERIORATION_UNRESOLVED': 1,
    'FOLLOWUP_MISSING': 2,
    'LAB_OVERDUE': 3,
    'VITALS_OVERDUE': 4,
    'SCREENING_OVERDUE': 5
}

async def add_gap_if_not_exists(patient, gap_type):
    patient_id = str(patient.get('_id'))
    existing = await db.care_gaps.find_one({
        'patient_id': patient_id,
        'gap_type': gap_type,
        'status': 'pending'
    })
    
    if not existing:
        # Draft message
        diagnosis = ", ".join(patient.get('chronic_conditions', []))
        if not diagnosis:
            diagnosis = "general health"
            
        msg = draft_outreach_message(
            patient_name=patient.get('name', 'Patient'),
            patient_age=patient.get('age', 0),
            diagnosis=diagnosis,
            gap_type=gap_type,
            language=patient.get('language', 'English')
        )
        
        await db.care_gaps.insert_one({
            'patient_id': patient_id,
            'gap_type': gap_type,
            'outreach_msg': msg,
            'status': 'pending',
            'priority': GAP_PRIORITY.get(gap_type, 5),
            'flagged_at': datetime.now(timezone.utc),
            'sent_at': None
        })
        print(f"Created {gap_type} gap for patient {patient_id}")

async def check_lab_overdue(patient):
    if 'diabetes' in [c.lower() for c in patient.get('chronic_conditions', [])]:
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        # Find any consultation in last 90 days with HbA1c
        recent_consult = await db.consultations.find_one({
            'patient_id': str(patient.get('_id')),
            'created_at': {'$gte': ninety_days_ago}
        })
        # Simplified: if no recent consult, flag it
        if not recent_consult:
            await add_gap_if_not_exists(patient, 'LAB_OVERDUE')

async def check_vitals_overdue(patient):
    if 'hypertension' in [c.lower() for c in patient.get('chronic_conditions', [])]:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_consult = await db.consultations.find_one({
            'patient_id': str(patient.get('_id')),
            'created_at': {'$gte': thirty_days_ago}
        })
        if not recent_consult:
            await add_gap_if_not_exists(patient, 'VITALS_OVERDUE')

async def check_screening_overdue(patient):
    if patient.get('age', 0) >= 40:
        year_ago = datetime.now(timezone.utc) - timedelta(days=365)
        recent_consult = await db.consultations.find_one({
            'patient_id': str(patient.get('_id')),
            'created_at': {'$gte': year_ago}
        })
        if not recent_consult:
            await add_gap_if_not_exists(patient, 'SCREENING_OVERDUE')

async def check_followup_missing(patient):
    # Find all consultations for patient
    patient_id = str(patient.get('_id'))
    async for consult in db.consultations.find({'patient_id': patient_id}):
        consult_id = str(consult.get('_id'))
        followup = await db.followups.find_one({'consultation_id': consult_id})
        if not followup:
            await add_gap_if_not_exists(patient, 'FOLLOWUP_MISSING')
            break

async def check_deterioration_unresolved(patient):
    patient_id = str(patient.get('_id'))
    forty_eight_hours_ago = datetime.now(timezone.utc) - timedelta(hours=48)
    
    # Needs to be flagged for > 48h. For simplicity we check if there's a flagged followup older than 48h
    # Or just created_at older than 48h with status flagged
    bad_followup = await db.followups.find_one({
        'patient_id': patient_id,
        'status': 'flagged',
        'risk_label': {'$in': ['HIGH', 'CRITICAL']},
        'created_at': {'$lt': forty_eight_hours_ago}
    })
    
    if bad_followup:
        await add_gap_if_not_exists(patient, 'DETERIORATION_UNRESOLVED')

async def scan_patient(patient_id: str):
    """Run all gap checks for a single patient"""
    try:
        patient = await db.patients.find_one({'_id': ObjectId(patient_id)})
    except Exception:
        patient = await db.patients.find_one({'_id': patient_id}) # Fallback if stored as string somehow
        
    if not patient:
        return

    await check_lab_overdue(patient)
    await check_vitals_overdue(patient)
    await check_screening_overdue(patient)
    await check_followup_missing(patient)
    await check_deterioration_unresolved(patient)

async def scan_all_patients():
    """Nightly scan for all patients"""
    print("Starting full patient scan...")
    async for patient in db.patients.find():
        await scan_patient(str(patient.get('_id')))
    print("Full scan complete.")

async def listen_for_events():
    """Background task to listen to Redis events"""
    print("CareGap listening for events...")
    
    async def process_consultation_completed():
        try:
            async for event in subscribe('consultation.completed'):
                patient_id = event.get('patient_id')
                if patient_id:
                    print(f"Event received: consultation.completed for {patient_id}")
                    await scan_patient(patient_id)
        except Exception as e:
            print(f"Redis listen error (consultations): {e}")
                
    async def process_followup_flagged():
        try:
            async for event in subscribe('followup.flagged'):
                # For hackathon simplicity, let's just create the gap immediately if we get flagged.
                patient_id = event.get('patient_id')
                if patient_id:
                    print(f"Event received: followup.flagged for {patient_id}")
                    patient = await db.patients.find_one({'_id': ObjectId(patient_id)})
                    if patient:
                        await add_gap_if_not_exists(patient, 'DETERIORATION_UNRESOLVED')
        except Exception as e:
            print(f"Redis listen error (followups): {e}")
                    
    asyncio.create_task(process_consultation_completed())
    asyncio.create_task(process_followup_flagged())

def setup_scanner():
    """Initialize APScheduler and Redis listeners"""
    # Nightly at 2 AM
    scheduler.add_job(scan_all_patients, 'cron', hour=2, minute=0)
    scheduler.start()
    asyncio.create_task(listen_for_events())
