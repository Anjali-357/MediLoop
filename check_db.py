import asyncio
from bson import ObjectId
from shared.database import db

async def check():
    patient = await db.patients.find_one({"phone": {"$regex": "8817839559"}})
    if not patient:
        print("Patient not found")
        return
    print(f"Patient ID: {patient['_id']}")
    print(f"Patient Name: {patient.get('name')}")
    consult = await db.consultations.find_one({"patient_id": str(patient["_id"])}, sort=[("created_at", -1)])
    if consult:
        print(f"Consult found: {consult.get('_id')}")
        print(f"SOAP: {consult.get('soap_note')}")
    else:
        print("No consultation found for patient")

if __name__ == "__main__":
    asyncio.run(check())
