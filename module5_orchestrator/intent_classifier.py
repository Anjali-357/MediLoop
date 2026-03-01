"""
module5_orchestrator/intent_classifier.py
Gemini-powered intent classifier for incoming patient messages.
"""
import json
import os
import re
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
_model = genai.GenerativeModel("gemini-2.5-flash")

VALID_INTENTS = {"PAIN", "FOLLOWUP", "CARE_GAP", "GENERAL_QUERY", "EMERGENCY", "APPOINTMENT_REQUEST"}

INTENT_DESCRIPTIONS = {
    "PAIN": "ONLY for pediatric patients (under 6 years old) who cannot verbally express pain — parent/caregiver reports symptoms, crying, discomfort, or distress on behalf of the child",
    "FOLLOWUP": "Patient or caregiver asking about recovery progress, next appointment, discharge instructions, medication, or mentions pain/symptoms for a NON-pediatric patient",
    "CARE_GAP": "Patient mentions they haven't visited the clinic, missed a lab test, overdue checkup, or hasn't seen a doctor recently",
    "GENERAL_QUERY": "General health question, greeting, or unrelated query",
    "EMERGENCY": "Patient or caregiver expresses urgency, severe symptoms, difficulty breathing, chest pain, or life-threatening situation",
    "APPOINTMENT_REQUEST": "Patient explicitly wants to see a doctor, book/schedule an appointment, or asks when they can come in for a visit",
}


async def classify_intent(
    message: str,
    patient_name: str = "Patient",
    diagnosis: str = "general health",
    recent_history: list[dict] | None = None,
    is_pediatric: bool = False,
    age: int = 0,
) -> dict:
    """
    Classify the intent of a patient WhatsApp message.
    Returns: { intent, confidence, reasoning, suggested_module }
    """
    history_text = ""
    if recent_history:
        history_text = "\n".join(
            f"[{m.get('role','?').upper()}]: {m.get('message','')}"
            for m in recent_history[-4:]
        )

    intent_list = "\n".join(
        f"- {k}: {v}" for k, v in INTENT_DESCRIPTIONS.items()
    )

    pediatric_note = (
        f"⚠️ IMPORTANT: This patient is {age} years old and is a PEDIATRIC patient (under 6). "
        "They CANNOT verbally express pain. Use PAIN intent if caregiver reports any pain/discomfort symptoms."
        if is_pediatric and age < 6
        else
        f"⚠️ IMPORTANT: This patient is {age} years old and is NOT a pediatric patient. "
        "Do NOT use PAIN intent — use FOLLOWUP for any pain/symptom concerns instead."
    )

    prompt = f"""You are a medical AI triage system for MediLoop.

Patient: {patient_name}, Age: {age}
Diagnosis: {diagnosis}
{pediatric_note}

{"Recent conversation:" + chr(10) + history_text if history_text else ""}

New message: "{message}"

Classify into EXACTLY ONE intent:
{intent_list}

Respond with ONLY a valid JSON object:
{{
  "intent": "<one of the 5 intents>",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence explanation>"
}}
No markdown. No extra text."""

    try:
        resp = await _model.generate_content_async(prompt)
        raw = resp.text.strip()
        raw = re.sub(r"```[a-z]*", "", raw).strip("` \n")
        result = json.loads(raw)
        if result.get("intent") not in VALID_INTENTS:
            result["intent"] = "GENERAL_QUERY"
        result["confidence"] = float(result.get("confidence", 0.7))
        return result
    except Exception as e:
        print(f"[orchestrator] Intent classification error: {e}")
        return {
            "intent": "GENERAL_QUERY",
            "confidence": 0.5,
            "reasoning": "Fallback due to classification error",
        }


INTENT_TO_MODULE = {
    "PAIN": "painscan",
    "FOLLOWUP": "recoverbot",
    "CARE_GAP": "caregap",
    "GENERAL_QUERY": "chatbot",
    "EMERGENCY": "emergency",
    "APPOINTMENT_REQUEST": "appointment",
}
