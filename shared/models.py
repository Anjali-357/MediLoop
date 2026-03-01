from pydantic import BaseModel, Field, validator
from typing import Any, Optional, List
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate)
            ])
        ])

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)


class MongoBaseModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        populate_by_name = True


class APIResponse(BaseModel):
    success: bool
    data: Any = None
    message: str = ""


class TokenPayload(BaseModel):
    sub: str          # user_id / doctor_id
    role: str = "doctor"
    exp: Optional[int] = None


class PatientOut(MongoBaseModel):
    name: str
    dob: Optional[datetime] = None
    phone: Optional[str] = None
    language: Optional[str] = "English"
    doctor_id: Optional[str] = None
    age: Optional[int] = None
    chronic_conditions: List[str] = []
    onboarding_status: str = "completed"
    source: str = "clinic"
    last_active_at: datetime = Field(default_factory=datetime.utcnow)
    whatsapp_opt_in: bool = False

class DoctorOut(MongoBaseModel):
    name: str
    phone: str
    speciality: str
    hospital: str
    whatsapp_number: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DoctorPatientMapOut(MongoBaseModel):
    doctor_id: str
    patient_id: str
    relationship_status: str = "active"
    primary_doctor: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ICDCode(BaseModel):
    code: str
    description: str
    confidence: float


class SOAPNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str


class ConsultationOut(MongoBaseModel):
    patient_id: str
    doctor_id: str
    transcript: str
    soap_note: SOAPNote
    icd_codes: List[ICDCode]
    status: str
    created_at: datetime


class ConversationEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    role: str          # 'bot' | 'patient'
    message: str


class CheckinSlot(BaseModel):
    scheduled_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "pending"   # 'pending' | 'completed' | 'missed'


class FollowupOut(MongoBaseModel):
    patient_id: str
    consultation_id: str
    status: str                           # 'active' | 'completed' | 'flagged'
    risk_score: float = 0.0
    risk_label: str = "LOW"               # 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    conversation_log: List[ConversationEntry] = []
    checkin_schedule: List[CheckinSlot] = []
    is_pediatric: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator("id", pre=True, always=True)
    def stringify_id(cls, v):
        return str(v)


class PainScoreOut(MongoBaseModel):
    patient_id: str
    followup_id: str
    score: int
    frame_scores: List[int]
    frame_count: int
    created_at: datetime
    
    # Multimodal Optional Fields
    resp_rate: Optional[float] = None
    heart_rate: Optional[float] = None
    cry_intensity: Optional[float] = None
    agitation_score: Optional[float] = None
    risk_level: Optional[str] = None
    modalities_used: Optional[List[str]] = None

    @validator("id", pre=True, always=True)
    def stringify_id_painscore(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return str(v)


class CareGapOut(MongoBaseModel):
    patient_id: str
    gap_type: str
    outreach_msg: str = ""
    status: str
    priority: int = 1
    flagged_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None


class AIDecisionOut(MongoBaseModel):
    patient_id: str
    intent: str
    confidence: float
    reasoning: str
    suggested_module: str
    trigger_source: str
    created_at: datetime
