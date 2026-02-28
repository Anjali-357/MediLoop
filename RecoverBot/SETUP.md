# RecoverBot — Module 2 · MediLoop

> AI-powered post-discharge patient follow-up, conversational check-ins, sklearn risk scoring, and real-time doctor alerts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Uvicorn |
| Database | MongoDB (Motor async) |
| Messaging | Redis pub/sub (aioredis) |
| Scheduling | APScheduler |
| AI Conversation | Google Gemini 1.5 Flash |
| Risk ML | sklearn RandomForestClassifier |
| WhatsApp/SMS | Twilio |
| Frontend | React 18 + Vite |

---

## Project Structure

```
RecoverBot/
├── main.py                          # FastAPI app entry point
├── requirements.txt
├── .env.example                     # Copy → .env and fill in secrets
│
├── shared/                          # Shared across all MediLoop modules
│   ├── database.py                  # Single Motor client
│   ├── events.py                    # Redis pub/sub helpers
│   ├── models.py                    # Shared Pydantic models (FollowupOut, etc.)
│   └── auth.py                      # JWT get_current_user dependency
│
├── module2_recoverbot/
│   ├── router.py                    # FastAPI APIRouter (all endpoints)
│   ├── events.py                    # Redis subscriber: patient.discharged
│   ├── train_risk_model.py          # Train & save risk_model.pkl
│   ├── risk_model.pkl               # Pre-trained RandomForest (auto-generated)
│   └── services/
│       ├── followup_service.py      # Core business logic
│       ├── gemini_service.py        # Gemini conversation + feature extraction
│       ├── risk_service.py          # sklearn inference
│       ├── twilio_service.py        # WhatsApp/SMS via Twilio
│       └── scheduler_service.py    # APScheduler check-in jobs
│
└── frontend/
    └── src/
        ├── App.jsx                  # Standalone demo wrapper + AppContext
        ├── index.css
        └── modules/recoverbot/
            ├── index.jsx            # ← Module export (use in MediLoop shell)
            └── components/
                ├── FollowupList.jsx
                ├── RiskBadge.jsx
                ├── AlertFeed.jsx
                └── CheckinHistory.jsx
```

---

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Fill in: MONGO_URI, GEMINI_API_KEY, TWILIO_*, JWT_SECRET
```

### 2. Python backend

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Train the ML risk model (one-time, ~5 seconds)
python -m module2_recoverbot.train_risk_model

# Start backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

---

## API Reference

All endpoints are prefixed with `/api/recoverbot`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/start` | JWT | Manually start follow-up for a patient |
| `GET` | `/followups/{patient_id}` | JWT | All followup docs for a patient |
| `GET` | `/risk-flagged` | JWT | All HIGH/CRITICAL patients |
| `POST` | `/webhook/twilio` | None | Twilio WhatsApp webhook |
| `WS` | `/ws/alerts` | None | Real-time alert stream |
| `GET` | `/health` | None | Health check |

### Example: Manually start a follow-up

```http
POST /api/recoverbot/start?patient_id=ABC&consultation_id=XYZ
Authorization: Bearer <token>
```

### Example: Twilio Webhook (simulated)

```http
POST /api/recoverbot/webhook/twilio
Content-Type: application/x-www-form-urlencoded

From=whatsapp%3A%2B919876543210&Body=I+have+a+pain+level+of+7+and+slight+fever
```

---

## Redis Events

| Direction | Channel | Payload |
|---|---|---|
| **Subscribes** | `patient.discharged` | `{ patient_id, consultation_id }` |
| **Publishes** | `followup.flagged` | `{ patient_id, risk_score, risk_label, followup_id }` |

---

## ML Risk Model

The `RandomForestClassifier` trains on 7 features:

| Feature | Type | Description |
|---|---|---|
| `pain_score` | 0–10 | Reported pain level |
| `fever_present` | bool | Fever present |
| `swelling` | bool | Swelling present |
| `medication_adherent` | bool | Taking medications as prescribed |
| `days_since_discharge` | int | Days since hospital discharge |
| `age` | int | Patient age in years |
| `diagnosis_severity` | 1–3 | Low / Medium / High |

**Labels:** `LOW · MEDIUM · HIGH · CRITICAL`  
**Accuracy:** ~93% on held-out test set

---

## MongoDB Schema — `followups` collection

```json
{
  "_id":              "ObjectId",
  "patient_id":       "string (ref → patients._id)",
  "consultation_id":  "string (ref → consultations._id)",
  "status":           "active | completed | flagged",
  "risk_score":       0.0,
  "risk_label":       "LOW | MEDIUM | HIGH | CRITICAL",
  "conversation_log": [{ "timestamp": "ISO", "role": "bot|patient", "message": "..." }],
  "checkin_schedule": [{ "scheduled_at": "ISO", "completed_at": "ISO|null", "status": "pending|completed|missed" }],
  "is_pediatric":     false,
  "created_at":       "ISO"
}
```

---

## Check-in Schedule

Patients receive messages at these offsets from discharge time:

| Check-in | Offset |
|---|---|
| 1 | 6 hours |
| 2 | 24 hours |
| 3 | 48 hours |
| 4 | 72 hours |
| 5 | Day 7 |
| 6 | Day 14 |

---

## Integration Checklist (MediLoop Multi-Module)

- ✅ `from shared.database import db` — only Motor client
- ✅ Subscribe to `patient.discharged` via `shared/events.py`
- ✅ Publish `followup.flagged` via `shared/events.py`
- ✅ `from shared.models import FollowupOut` — no local Pydantic models
- ✅ All responses wrapped: `{ success, data, message }`
- ✅ All endpoints use `Depends(get_current_user)`
- ✅ Router prefix set in `main.py`, not in module
- ✅ Pediatric hook: WS event `painscan.requested` when `is_pediatric=True`
