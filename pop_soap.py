import asyncio
from datetime import datetime, timezone
import os

from shared.database import db

async def pop():
    patient = await db.patients.find_one({"phone": {"$regex": "8817839559"}})
    if not patient:
        print("Patient not found")
        return
        
    pid = str(patient["_id"])
    now = datetime.now(timezone.utc)
    
    # Check if a consultation exists
    consult = await db.consultations.find_one({"patient_id": pid}, sort=[("created_at", -1)])
    
    soap = {
        "subjective": "Patient reports worsening migraine pain, rated 7/10, accompanied by mild nausea.",
        "objective": "Patient appears uncomfortable. Vitals stable. No focal neurological deficits.",
        "assessment": "Acute migraine attack without aura.",
        "plan": "Prescribed Sumatriptan 50mg PRN. Recommended rest in a dark, quiet room. Follow up if symptoms worsen or persist beyond 48 hours."
    }
    
    if consult:
        await db.consultations.update_one(
            {"_id": consult["_id"]},
            {"$set": {"soap_note": soap}}
        )
        print(f"Updated existing consult {consult['_id']} for Aryan with SOAP note.")
    else:
        res = await db.consultations.insert_one({
            "patient_id": pid,
            "doctor_id": "dummy_doc",
            "status": "discharged",
            "soap_note": soap,
            "diagnosis": "Migraine",
            "created_at": now
        })
        print(f"Inserted new consult {res.inserted_id} for Aryan with SOAP note.")

if __name__ == "__main__":
    asyncio.run(pop())
