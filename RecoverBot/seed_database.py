#!/usr/bin/env python3
"""
seed_database.py — RecoverBot Demo Data Seeder
===============================================
Populates MongoDB Atlas with realistic dummy data so the dashboard
looks fully live without needing any real WhatsApp messages.

Inserts:
  • 8 patients  (adults + 1 paediatric)
  • 8 consultations
  • 8 followups  (LOW / MEDIUM / HIGH / CRITICAL risk levels)
  • Rich conversation logs per followup
  • Completed & pending check-in schedules

Usage:
  python seed_database.py           # fresh seed (drops existing demo data)
  python seed_database.py --wipe    # wipe ALL followups, patients, consultations first
"""

import asyncio
import sys
import random
from datetime import datetime, timedelta
from urllib.parse import urlparse
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv(".env")

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME   = urlparse(MONGO_URI).path.lstrip("/").split("?")[0] or "mediloop"

# ─── Seed data ────────────────────────────────────────────────────────────────

PATIENTS = [
    {
        "name": "Arjun Mehta",          "age": 58, "phone": "+919876540001",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": ["hypertension", "diabetes"],
        "dob": "1966-03-12",            "doctor_id": "doctor_001",
        "diagnosis": "Post-operative cardiac bypass recovery",
        "icd": ["I21.9"],               "severity": 3,
    },
    {
        "name": "Priya Sharma",         "age": 44, "phone": "+919876540002",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": ["asthma"],
        "dob": "1980-07-22",            "doctor_id": "doctor_001",
        "diagnosis": "Appendectomy recovery",
        "icd": ["K37"],                "severity": 2,
    },
    {
        "name": "Ravi Patel",           "age": 72, "phone": "+919876540003",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": ["COPD", "hypertension"],
        "dob": "1952-11-05",            "doctor_id": "doctor_001",
        "diagnosis": "Pneumonia — bilateral",
        "icd": ["J18.9"],              "severity": 3,
    },
    {
        "name": "Lata Verma",           "age": 35, "phone": "+919876540004",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": [],
        "dob": "1989-01-30",            "doctor_id": "doctor_001",
        "diagnosis": "Cesarean section recovery",
        "icd": ["O82"],                "severity": 2,
    },
    {
        "name": "Suresh Nair",          "age": 61, "phone": "+919876540005",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": ["type 2 diabetes"],
        "dob": "1963-06-18",            "doctor_id": "doctor_001",
        "diagnosis": "Total knee replacement",
        "icd": ["Z96.641"],            "severity": 2,
    },
    {
        "name": "Ananya Singh",         "age": 27, "phone": "+919876540006",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": [],
        "dob": "1997-09-14",            "doctor_id": "doctor_001",
        "diagnosis": "Laparoscopic cholecystectomy",
        "icd": ["K80.20"],             "severity": 1,
    },
    {
        "name": "Vikram Desai",         "age": 49, "phone": "+919876540007",
        "language": "en",               "is_pediatric": False,
        "chronic_conditions": ["hypertension"],
        "dob": "1975-04-02",            "doctor_id": "doctor_001",
        "diagnosis": "Acute myocardial infarction recovery",
        "icd": ["I22.9"],              "severity": 3,
    },
    {
        "name": "Rohan Kapoor",         "age": 8,  "phone": "+919876540008",
        "language": "en",               "is_pediatric": True,
        "chronic_conditions": [],
        "dob": "2016-12-09",            "doctor_id": "doctor_001",
        "diagnosis": "Post-tonsillectomy recovery",
        "icd": ["J35.01"],             "severity": 1,
    },
]

# (risk_score, risk_label, status, conversation, days_ago)
FOLLOWUP_CONFIGS = [
    # Arjun — CRITICAL
    {
        "risk_score": 0.94, "risk_label": "CRITICAL", "status": "flagged",
        "days_ago": 2,
        "conversation": [
            ("bot",     "Hi Arjun! Hope you're resting well after your bypass. How are you feeling today?"),
            ("patient", "Not good at all. Chest pain is severe, maybe 9 out of 10."),
            ("bot",     "I'm very concerned about that. Do you have a fever or trouble breathing?"),
            ("patient", "Yes, I'm sweating a lot and feeling short of breath. Haven't taken my blood thinners either."),
            ("bot",     "Arjun, these are serious symptoms. Please go to the emergency room immediately."),
        ],
    },
    # Priya — HIGH
    {
        "risk_score": 0.78, "risk_label": "HIGH", "status": "flagged",
        "days_ago": 3,
        "conversation": [
            ("bot",     "Hi Priya! Checking in after your appendectomy. How are things going?"),
            ("patient", "The wound area is quite swollen and it's been hurting a lot. Pain around 7."),
            ("bot",     "Any fever or redness around the wound site?"),
            ("patient", "Yes, there's some redness and I think I had a fever last night, around 38.5°C."),
            ("bot",     "That sounds like it could be an infection. Please contact your surgeon today."),
        ],
    },
    # Ravi — CRITICAL
    {
        "risk_score": 0.91, "risk_label": "CRITICAL", "status": "flagged",
        "days_ago": 1,
        "conversation": [
            ("bot",     "Hello Ravi! How are you feeling today after being discharged?"),
            ("patient", "Very bad. My breathing is laboured and I can barely walk to the bathroom."),
            ("bot",     "Are you using your inhaler and taking the prescribed antibiotics?"),
            ("patient", "I ran out of antibiotics two days ago and my breathing is worse than in hospital."),
            ("bot",     "This is urgent. Please call emergency services or have someone take you to hospital now."),
        ],
    },
    # Lata — MEDIUM
    {
        "risk_score": 0.48, "risk_label": "MEDIUM", "status": "active",
        "days_ago": 5,
        "conversation": [
            ("bot",     "Hi Lata! Hope you and baby are doing well. Any discomfort at the incision site?"),
            ("patient", "A bit sore around the stitches. Pain maybe 4 out of 10. Normal I think?"),
            ("bot",     "Some soreness is expected. Any signs of fever or unusual discharge?"),
            ("patient", "No fever. Just tired. I'm taking my iron supplements."),
            ("bot",     "That's great to hear! Keep resting and we'll check in again tomorrow."),
        ],
    },
    # Suresh — MEDIUM
    {
        "risk_score": 0.52, "risk_label": "MEDIUM", "status": "active",
        "days_ago": 4,
        "conversation": [
            ("bot",     "Good morning Suresh! How's the knee feeling after the replacement?"),
            ("patient", "Still pretty painful when I try to walk, around 6 out of 10."),
            ("bot",     "Are you doing the prescribed physiotherapy exercises?"),
            ("patient", "I've been skipping them because of the pain. Should I be worried?"),
            ("bot",     "Try to do light exercises as your physio recommended. Pain medication might help."),
        ],
    },
    # Ananya — LOW
    {
        "risk_score": 0.12, "risk_label": "LOW", "status": "active",
        "days_ago": 7,
        "conversation": [
            ("bot",     "Hi Ananya! Checking in after your gallbladder surgery. How do you feel?"),
            ("patient", "Feeling much better actually! Pain is just 1-2 out of 10 now."),
            ("bot",     "Wonderful! Any nausea or problems with food?"),
            ("patient", "A little queasy after heavy food but otherwise good. Taking my meds regularly."),
            ("bot",     "That's a great recovery! Stick to low-fat foods for another week."),
        ],
    },
    # Vikram — HIGH
    {
        "risk_score": 0.82, "risk_label": "HIGH", "status": "flagged",
        "days_ago": 2,
        "conversation": [
            ("bot",     "Hi Vikram! Following up on your heart attack recovery. How's your energy today?"),
            ("patient", "Chest feels tight again. Different from the initial heart attack but uncomfortable."),
            ("bot",     "Any radiating pain to your arm or jaw? Are you on aspirin and your other medications?"),
            ("patient", "Mild arm pain yes. I forgot to take my aspirin yesterday and today."),
            ("bot",     "Please take your aspirin now and contact your cardiologist immediately."),
        ],
    },
    # Rohan — LOW (paediatric)
    {
        "risk_score": 0.08, "risk_label": "LOW", "status": "completed",
        "days_ago": 10,
        "conversation": [
            ("bot",     "Hi! This is RecoverBot checking on Rohan after his tonsil surgery. How is he doing?"),
            ("patient", "He's doing okay, eating ice cream and watching cartoons! Pain seems around 2."),
            ("bot",     "That sounds lovely! Any fever or trouble swallowing?"),
            ("patient", "No fever at all. He's swallowing fine now. Very happy little boy!"),
            ("bot",     "What a great recovery! Keep him hydrated and continue the pain medication as needed."),
        ],
    },
]

CHECKIN_OFFSETS_H = [6, 24, 48, 72, 24*7, 24*14]


def make_checkin_schedule(discharged_at: datetime, days_ago: int) -> list[dict]:
    now = datetime.utcnow()
    slots = []
    for i, offset_h in enumerate(CHECKIN_OFFSETS_H):
        run_at = discharged_at + timedelta(hours=offset_h)
        if run_at < now:
            slots.append({
                "scheduled_at": run_at.isoformat(),
                "completed_at": (run_at + timedelta(minutes=random.randint(5, 30))).isoformat(),
                "status": "completed",
            })
        else:
            slots.append({
                "scheduled_at": run_at.isoformat(),
                "completed_at": None,
                "status": "pending",
            })
    return slots


# ─── Main seeder ─────────────────────────────────────────────────────────────

async def seed():
    wipe = "--wipe" in sys.argv
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    if wipe:
        print("⚠️  Wiping existing collections...")
        await db.patients.delete_many({})
        await db.consultations.delete_many({})
        await db.followups.delete_many({})
        print("✅ Collections cleared\n")
    else:
        # Only remove our demo data (identified by doctor_id=doctor_001)
        await db.patients.delete_many({"doctor_id": "doctor_001"})
        await db.consultations.delete_many({})
        await db.followups.delete_many({"_seeded": True})

    print(f"📦 Seeding into database: {DB_NAME}")
    print("─" * 50)

    for i, (patient_config, fu_config) in enumerate(zip(PATIENTS, FOLLOWUP_CONFIGS)):
        days_ago     = fu_config["days_ago"]
        discharged_at = datetime.utcnow() - timedelta(days=days_ago)

        # ── Patient ──────────────────────────────────────────────────────────
        patient_doc = {
            "name":               patient_config["name"],
            "phone":              patient_config["phone"],
            "age":                patient_config["age"],
            "dob":                patient_config["dob"],
            "language":           patient_config["language"],
            "is_pediatric":       patient_config["is_pediatric"],
            "chronic_conditions": patient_config["chronic_conditions"],
            "doctor_id":          patient_config["doctor_id"],
            "created_at":         discharged_at - timedelta(hours=2),
        }
        p_res = await db.patients.insert_one(patient_doc)
        patient_id = str(p_res.inserted_id)

        # ── Consultation ──────────────────────────────────────────────────────
        consultation_doc = {
            "patient_id":    patient_id,
            "transcript":    f"Patient {patient_config['name']} presented with {patient_config['diagnosis'].lower()}.",
            "soap_note":     (
                f"S: {patient_config['diagnosis']}. "
                f"O: Vitals stable at discharge. "
                f"A: {patient_config['diagnosis']}. "
                f"P: Discharge home with follow-up instructions."
            ),
            "icd_codes":     patient_config["icd"],
            "diagnosis":     patient_config["diagnosis"],
            "status":        "discharged",
            "created_at":    discharged_at,
        }
        c_res = await db.consultations.insert_one(consultation_doc)
        consultation_id = str(c_res.inserted_id)

        # ── Conversation log ──────────────────────────────────────────────────
        conv_log = []
        for j, (role, msg) in enumerate(fu_config["conversation"]):
            conv_log.append({
                "timestamp": (discharged_at + timedelta(hours=6, minutes=j*8)).isoformat(),
                "role":      role,
                "message":   msg,
            })

        # ── Follow-up ─────────────────────────────────────────────────────────
        followup_doc = {
            "patient_id":       patient_id,
            "patient_name":     patient_config["name"],
            "consultation_id":  consultation_id,
            "status":           fu_config["status"],
            "risk_score":       fu_config["risk_score"],
            "risk_label":       fu_config["risk_label"],
            "conversation_log": conv_log,
            "checkin_schedule": make_checkin_schedule(discharged_at, days_ago),
            "is_pediatric":     patient_config["is_pediatric"],
            "created_at":       discharged_at.isoformat(),
            "_seeded":          True,   # marker for cleanup
        }
        fu_res = await db.followups.insert_one(followup_doc)

        badge = {
            "LOW":      "🟢",
            "MEDIUM":   "🟡",
            "HIGH":     "🟠",
            "CRITICAL": "🔴",
        }.get(fu_config["risk_label"], "⚪")

        print(
            f"  {badge} {patient_config['name']:<20} "
            f"risk={fu_config['risk_label']:<8} "
            f"status={fu_config['status']:<10} "
            f"followup_id={str(fu_res.inserted_id)}"
        )

    print("─" * 50)

    # ── Summary stats ─────────────────────────────────────────────────────────
    total    = await db.followups.count_documents({"_seeded": True})
    flagged  = await db.followups.count_documents({"_seeded": True, "risk_label": {"$in": ["HIGH", "CRITICAL"]}})
    active   = await db.followups.count_documents({"_seeded": True, "status": "active"})
    complete = await db.followups.count_documents({"_seeded": True, "status": "completed"})

    print(f"\n✅ Seeded {total} follow-ups into '{DB_NAME}'")
    print(f"   🔴 Flagged (HIGH/CRITICAL) : {flagged}")
    print(f"   🟡 Active                   : {active}")
    print(f"   🟢 Completed                : {complete}")
    print(f"\n🌐 Open the dashboard: http://localhost:80")
    print("   Log in (no token needed) → you'll see all patients populated.\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
