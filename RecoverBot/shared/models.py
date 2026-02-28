"""
shared/models.py
Pydantic models shared across ALL modules.
Never define your own Pydantic models locally — import from here.
"""
from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field, validator


# ─── Generic API Response wrapper ────────────────────────────────────────────

class APIResponse(BaseModel):
    success: bool
    data: Any = None
    message: str = ""


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TokenPayload(BaseModel):
    sub: str          # user_id / doctor_id
    role: str = "doctor"
    exp: Optional[int] = None


# ─── Followup (Module 2 — RecoverBot) ────────────────────────────────────────

class ConversationEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    role: str          # 'bot' | 'patient'
    message: str


class CheckinSlot(BaseModel):
    scheduled_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "pending"   # 'pending' | 'completed' | 'missed'


class FollowupOut(BaseModel):
    id: str = Field(alias="_id")
    patient_id: str
    consultation_id: str
    status: str                           # 'active' | 'completed' | 'flagged'
    risk_score: float = 0.0
    risk_label: str = "LOW"              # 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    conversation_log: List[ConversationEntry] = []
    checkin_schedule: List[CheckinSlot] = []
    is_pediatric: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator("id", pre=True, always=True)
    def stringify_id(cls, v):
        return str(v)

    class Config:
        populate_by_name = True
