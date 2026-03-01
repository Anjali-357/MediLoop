import datetime
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from shared.database import db
from shared.models import DoctorOut, DoctorPatientMapOut, PatientOut
from shared.events import publish

router = APIRouter(tags=['identity'])

class RegisterDoctorRequest(BaseModel):
    name: str
    phone: str
    speciality: str
    hospital: str

class OnboardPatientRequest(BaseModel):
    name: str
    age: int
    phone: str
    language: str

class MapRequest(BaseModel):
    doctor_id: str
    patient_id: str
    
class LoginRequest(BaseModel):
    name: str
    age: int

@router.post("/doctor/register", response_model=DoctorOut)
async def register_doctor(req: RegisterDoctorRequest):
    new_doc = {
        "name": req.name,
        "phone": req.phone,
        "speciality": req.speciality,
        "hospital": req.hospital,
        "whatsapp_number": req.phone,
        "status": "active",
        "created_at": datetime.datetime.utcnow()
    }
    result = await db.doctors.insert_one(new_doc)
    doc = await db.doctors.find_one({"_id": result.inserted_id})
    return DoctorOut(**doc)

@router.post("/patient/onboard", response_model=PatientOut)
async def onboard_patient(req: OnboardPatientRequest):
    # Dummy dob logic
    dob = datetime.datetime.utcnow() - datetime.timedelta(days=req.age * 365)
    
    new_patient = {
        "name": req.name,
        "dob": dob,
        "age": req.age,
        "phone": req.phone,
        "language": req.language,
        "doctor_id": "", # Will be mapped soon
        "chronic_conditions": [],
        "onboarding_status": "completed",
        "source": "clinic",
        "last_active_at": datetime.datetime.utcnow(),
        "whatsapp_opt_in": True
    }
    result = await db.patients.insert_one(new_patient)
    pt = await db.patients.find_one({"_id": result.inserted_id})
    
    await publish("patient.created", {"patient_id": str(pt["_id"])})
    return PatientOut(**pt)

@router.get("/patient/by-phone", response_model=PatientOut)
async def get_patient_by_phone(phone: str):
    pt = await db.patients.find_one({"phone": phone})
    if not pt:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Patient returning event
    await publish("patient.returning", {"patient_id": str(pt["_id"]), "phone": phone})
    
    # Update last active
    await db.patients.update_one({"_id": pt["_id"]}, {"$set": {"last_active_at": datetime.datetime.utcnow()}})
    
    return PatientOut(**pt)

@router.post("/map", response_model=DoctorPatientMapOut)
async def map_doctor_patient(req: MapRequest):
    # Ensure they exist
    from bson import ObjectId
    
    doc = await db.doctors.find_one({"_id": ObjectId(req.doctor_id) if ObjectId.is_valid(req.doctor_id) else req.doctor_id})
    pt = await db.patients.find_one({"_id": ObjectId(req.patient_id) if ObjectId.is_valid(req.patient_id) else req.patient_id})
    
    if not doc or not pt:
        raise HTTPException(status_code=404, detail="Doctor or Patient not found")
        
    mapping = {
        "doctor_id": str(doc["_id"]),
        "patient_id": str(pt["_id"]),
        "relationship_status": "active",
        "primary_doctor": True,
        "created_at": datetime.datetime.utcnow()
    }
    
    result = await db.doctor_patient_map.insert_one(mapping)
    
    # Update patient doc
    await db.patients.update_one({"_id": pt["_id"]}, {"$set": {"doctor_id": str(doc["_id"])}})
    
    mapping_record = await db.doctor_patient_map.find_one({"_id": result.inserted_id})
    
    await publish("patient.mapped", {"patient_id": str(pt["_id"]), "doctor_id": str(doc["_id"])})
    return DoctorPatientMapOut(**mapping_record)

@router.get("/patients/dashboard")
async def get_patients_dashboard():
    """
    Returns a list of all patients from the MongoDB collection for the dashboard view.
    """
    cursor = db.patients.find({})
    patients = await cursor.to_list(length=100) # Arbitrary limit for hackathon
    
    import json
    
    # Serialize ObjectId and datetime using the Pydantic model
    final_patients = []
    for pt in patients:
        # Fallbacks for old/legacy patient records missing required schema fields
        if "dob" not in pt:
            pt["dob"] = datetime.datetime.utcnow() - datetime.timedelta(days=pt.get("age", 30) * 365)
        if "language" not in pt:
            pt["language"] = "English"
        if "chronic_conditions" not in pt:
            pt["chronic_conditions"] = []
            
        # Fetch insights for this patient
        pt_id_str = str(pt.get("_id"))
        
        # 1. Latest Consultation
        latest_consultation = await db.consultations.find_one(
            {"patient_id": pt_id_str}, 
            sort=[("created_at", -1)]
        )
        if latest_consultation:
            latest_consultation["_id"] = str(latest_consultation["_id"])
            if "created_at" in latest_consultation and isinstance(latest_consultation["created_at"], datetime.datetime):
                latest_consultation["created_at"] = latest_consultation["created_at"].isoformat()
                
        # 2. Latest Followup
        latest_followup = await db.followups.find_one(
            {"patient_id": pt_id_str},
            sort=[("created_at", -1)]
        )
        if latest_followup:
            latest_followup["_id"] = str(latest_followup["_id"])
            if "created_at" in latest_followup and isinstance(latest_followup["created_at"], datetime.datetime):
                latest_followup["created_at"] = latest_followup["created_at"].isoformat()
                
        # 3. Pending Care Gaps
        pending_gaps_cursor = db.care_gaps.find(
            {"patient_id": pt_id_str, "status": "pending"}
        )
        pending_gaps = await pending_gaps_cursor.to_list(length=10)
        for g in pending_gaps:
            g["_id"] = str(g["_id"])
            if "flagged_at" in g and isinstance(g["flagged_at"], datetime.datetime):
                g["flagged_at"] = g["flagged_at"].isoformat()
            if "sent_at" in g and isinstance(g["sent_at"], datetime.datetime):
                 g["sent_at"] = g["sent_at"].isoformat()
        
        try:
            pt_serialized = json.loads(PatientOut(**pt).json(by_alias=True))
            # Attach insights
            pt_serialized["insights"] = {
                "latest_consultation": latest_consultation,
                "latest_followup": latest_followup,
                "pending_care_gaps": pending_gaps
            }
            final_patients.append(pt_serialized)
        except Exception as e:
            print(f"Skipping patient {pt.get('_id')} due to validation error: {e}")
            continue
        
    return {
        "success": True,
        "data": final_patients
    }

@router.post("/login")
async def combined_login(req: LoginRequest):
    """
    Hackathon helper endpoint.
    Takes Name and Age.
    Finds or creates the default Doctor.
    Finds or creates the Patient.
    Maps them if not mapped.
    Returns both.
    """
    # 1. Ensure mock doctor exists
    doc = await db.doctors.find_one({"name": "Dr. Sarah Adams"})
    if not doc:
        print("Creating mock doctor...")
        result = await db.doctors.insert_one({
            "name": "Dr. Sarah Adams",
            "phone": "+1234567890",
            "speciality": "General Practitioner",
            "hospital": "MediLoop Care Center",
            "whatsapp_number": "+1234567890",
            "status": "active",
            "created_at": datetime.datetime.utcnow()
        })
        doc = await db.doctors.find_one({"_id": result.inserted_id})
    else:
        print("Found mock doc:", doc["_id"])

    doc_id_str = str(doc["_id"])

    # 2. Find or create patient
    pt = await db.patients.find_one({"name": {"$regex": f"^{req.name}$", "$options": "i"}, "age": req.age})
    if not pt:
        # Create
        print("Creating patient from login prompt...")
        dob = datetime.datetime.utcnow() - datetime.timedelta(days=req.age * 365)
        new_pt = {
            "name": req.name,
            "dob": dob,
            "age": req.age,
            "phone": "+default_whatsapp",
            "language": "English",
            "doctor_id": doc_id_str, 
            "chronic_conditions": [],
            "onboarding_status": "completed",
            "source": "digital_login",
            "last_active_at": datetime.datetime.utcnow(),
            "whatsapp_opt_in": True
        }
        res = await db.patients.insert_one(new_pt)
        pt = await db.patients.find_one({"_id": res.inserted_id})
        await publish("patient.created", {"patient_id": str(pt["_id"])})
    else:
        print("Found existing pt:", pt["_id"])
        # Update active time
        await db.patients.update_one({"_id": pt["_id"]}, {"$set": {"last_active_at": datetime.datetime.utcnow()}})
        await publish("patient.returning", {"patient_id": str(pt["_id"]), "phone": pt.get("phone", "")})
        
    pt_id_str = str(pt["_id"])

    # 3. Ensure map exists
    mapping = await db.doctor_patient_map.find_one({"doctor_id": doc_id_str, "patient_id": pt_id_str})
    if not mapping:
        print("Creating map...")
        await db.doctor_patient_map.insert_one({
            "doctor_id": doc_id_str,
            "patient_id": pt_id_str,
            "relationship_status": "active",
            "primary_doctor": True,
            "created_at": datetime.datetime.utcnow()
        })
        
        # Keep patient synchronized with doc
        await db.patients.update_one({"_id": pt["_id"]}, {"$set": {"doctor_id": doc_id_str}})
        
        await publish("patient.mapped", {"patient_id": pt_id_str, "doctor_id": doc_id_str})

    import json
    final_doc = json.loads(DoctorOut(**doc).json(by_alias=True))
    
    pt_final = await db.patients.find_one({"_id": pt["_id"]})
    final_patient = json.loads(PatientOut(**pt_final).json(by_alias=True))
    
    return {
        "success": True,
        "doctor": final_doc,
        "patient": final_patient
    }
