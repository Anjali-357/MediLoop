# 👁️ Module 3 — PainScan: Handoff from Module 2 (RecoverBot)

> **For:** Developer 3 (PainScan)
> **From:** Developer 2 (RecoverBot)
> **Project:** MediLoop · Hackathon Build

---

## TL;DR — What You Need From Me

Module 2 (RecoverBot) activates your module. Here's exactly what happens and what you must build in response.

---

## 1. How RecoverBot Triggers PainScan

When a **pediatric patient** (age < 12) replies to a check-in and their risk is scored, RecoverBot broadcasts this WebSocket event to **all connected frontend clients**:

```json
{
  "type": "painscan.requested",
  "patient_id": "<MongoDB ObjectId as string>",
  "followup_id": "<MongoDB ObjectId as string>"
}
```

**Where it comes from:** `module2_recoverbot/services/followup_service.py`

```python
if followup.get("is_pediatric"):
    if ws_manager:
        await ws_manager.broadcast({
            "type": "painscan.requested",
            "patient_id": patient_id,
            "followup_id": str(followup_id),
        })
```

**WebSocket endpoint:** `ws://localhost:8000/api/recoverbot/ws/alerts`

Your frontend **listens on the shared AppContext WebSocket** (do NOT create a new connection). When a message with `type === "painscan.requested"` arrives, show your `ScanPrompt` UI immediately.

---

## 2. The `painscan.requested` Event Contract

| Field | Type | Example | Notes |
|---|---|---|---|
| `type` | `string` | `"painscan.requested"` | Always this exact string |
| `patient_id` | `string` | `"65f1a2b3c4d5e6f7a8b9c0d1"` | MongoDB ObjectId as plain string |
| `followup_id` | `string` | `"65f1a2b3c4d5e6f7a8b9c0d2"` | MongoDB ObjectId as plain string |

> [!IMPORTANT]
> The `followup_id` is critical — you must pass it when saving a pain score (see Section 4). This links the pain scan result back to the follow-up record that triggered it.

---

## 3. Running Without Module 2 (Standalone Dev)

Since you're developing in isolation, use this **mock trigger script** to simulate the `painscan.requested` WebSocket broadcast without needing the full Module 2 running.

Save as `mock_painscan_trigger.py` in the project root and run it:

```python
"""
mock_painscan_trigger.py
Simulates RecoverBot broadcasting a painscan.requested event.
Run: python mock_painscan_trigger.py
Requires: pip install aioredis
"""
import asyncio
import json
import aioredis

REDIS_URL = "redis://localhost:6379"

async def trigger():
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    # Publish directly to the channel RecoverBot uses
    payload = json.dumps({
        "type": "painscan.requested",
        "patient_id": "000000000000000000000001",   # use a real patient _id
        "followup_id": "000000000000000000000002",  # use a real followup _id
    })
    await r.publish("painscan.mock", payload)
    print("✅ painscan.requested event published")
    await r.aclose()

asyncio.run(trigger())
```

OR — even simpler for frontend-only dev — add this to your frontend `AppContext` mock:

```js
// In your dev/test setup, fire a fake WS message after 3 seconds
setTimeout(() => {
  window.dispatchEvent(new CustomEvent("ws_message", {
    detail: {
      type: "painscan.requested",
      patient_id: "mock-patient-001",
      followup_id: "mock-followup-001",
    }
  }));
}, 3000);
```

---

## 4. What You Must Build

### Backend — `module3_painscan/`

#### Your MongoDB Collection: `pain_scores`

```json
{
  "_id":          "ObjectId (auto)",
  "patient_id":   "string (from painscan.requested event)",
  "followup_id":  "string (from painscan.requested event)",
  "score":        8,
  "frame_scores": [6, 7, 8, 8, 9, 7, 8, 9, 8, 7],
  "created_at":   "2026-02-28T13:00:00Z"
}
```

> [!IMPORTANT]
> Store `patient_id` and `followup_id` as **plain strings, not ObjectId**. That is the MediLoop integration rule.

#### Your API Endpoints (prefix `/api/painscan`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/score` | Save a pain score result |
| `GET` | `/history/{patient_id}` | Return all pain scores for a patient |

#### `POST /api/painscan/score` — Request body

```json
{
  "patient_id":   "65f1a2b3...",
  "followup_id":  "65f1a2b3...",
  "score":        8,
  "frame_scores": [6, 7, 8, 8, 9, 7, 8, 9, 8, 7]
}
```

#### Redis Event You Must Publish After Scoring

```python
from shared.events import publish

await publish("pain.scored", {
    "patient_id":  patient_id,
    "followup_id": followup_id,
    "score":       score,
    "pain_score_id": str(result.inserted_id),
})
```

---

## 5. Shared Files — Read-Only for You

These files are already written by Module 2. You use them, you do not modify them (unless the team agrees):

| File | What to import |
|---|---|
| `shared/database.py` | `from shared.database import db` — use `db.pain_scores` |
| `shared/events.py` | `from shared.events import publish` |
| `shared/auth.py` | `from shared.auth import get_current_user` |
| `shared/models.py` | Add `PainScoreOut` here (it's the only new model you need) |

#### `PainScoreOut` model to add in `shared/models.py`

```python
class PainScoreOut(BaseModel):
    id: str = Field(alias="_id")
    patient_id: str
    followup_id: str
    score: int
    frame_scores: List[int] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator("id", pre=True, always=True)
    def stringify_id(cls, v):
        return str(v)

    class Config:
        populate_by_name = True
```

---

## 6. Frontend Integration

Your module lives at: `/frontend/src/modules/painscan/index.jsx`

### Listening for the trigger (use AppContext WS — DO NOT create a new WebSocket)

```jsx
// In your module's useEffect
const { ws } = useContext(AppContext);  // ws = the shared WebSocket instance

useEffect(() => {
  if (!ws) return;
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "painscan.requested") {
      setActivePatientId(msg.patient_id);
      setActiveFollowupId(msg.followup_id);
      setShowScanPrompt(true);  // activate your ScanPrompt UI
    }
  };
}, [ws]);
```

> [!WARNING]
> The PRD explicitly flags this mistake: **"WebSocket disconnect on painscan — Dev 3 creating new WS instead of reusing AppContext"**. Use `useContext(AppContext).ws`, not `new WebSocket(...)`.

---

## 7. Integration Test Sequence (Your Steps)

From the MediLoop Master PRD integration test table:

| # | Test | Expected Result |
|---|---|---|
| **7** | `POST /api/painscan/score` with mock `followup_id` | `pain_scores` doc saved, `pain.scored` Redis event fired |
| **8** | `GET /api/painscan/history/{patient_id}` | Returns array of score docs |

Run these **after** steps 1–6 pass (which are Modules 1 & 2's responsibility).

---

## 8. .env Variables You Need

You share the same `.env` file. No new variables needed — your module only uses:

```
MONGO_URI=...    # already set
REDIS_URL=...    # already set
JWT_SECRET=...   # already set
```

---

## 9. 5-Golden-Rules Checklist

Before you hand off to the integration manager:

- ✅ `from shared.database import db` — `db.pain_scores` for all queries
- ✅ `from shared.events import publish` — fire `pain.scored` after every score save
- ✅ `from shared.models import PainScoreOut` — add it to `shared/models.py`
- ✅ All endpoints return `APIResponse(success, data, message)`
- ✅ All endpoints use `Depends(get_current_user)` from `shared/auth.py`
- ✅ Router defined as `router = APIRouter()` — prefix set in `main.py`, NOT your module
- ✅ Frontend uses `AppContext.ws` — no new `WebSocket()` instantiation

---

## 10. At a Glance

```
You receive:   WebSocket event  →  { type: "painscan.requested", patient_id, followup_id }
You do:        Run OpenCV/MediaPipe/SVM scan  →  produce frame_scores + overall score
You save:      db.pain_scores.insert_one(...)
You publish:   Redis "pain.scored" event  →  { patient_id, followup_id, score, pain_score_id }
You expose:    POST /api/painscan/score
               GET  /api/painscan/history/{patient_id}
```

That's the complete contract. 🎯
