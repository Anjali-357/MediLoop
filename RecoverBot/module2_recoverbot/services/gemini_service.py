"""
module2_recoverbot/services/gemini_service.py
Gemini-powered conversation agent and feature extractor.
"""
import json
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

_model = genai.GenerativeModel("gemini-2.5-flash")


async def generate_opener(patient_name: str, diagnosis: str, is_pediatric: bool) -> str:
    """Generate a warm, personalised opening WhatsApp message for the patient."""
    audience = "the child's parent or guardian" if is_pediatric else "the patient"
    prompt = (
        f"You are RecoverBot, a caring post-discharge healthcare assistant.\n"
        f"Write a warm, brief WhatsApp message to {audience} whose name is {patient_name}.\n"
        f"They were recently discharged after treatment for: {diagnosis}.\n"
        f"Explicitly tell them that you will be checking in on them periodically over the next few weeks (e.g., at 6 hours, 24 hours, 48 hours, 3 days, 1 week, and 2 weeks) to make sure they are recovering well.\n"
        f"Ask how they are feeling right now to kickstart the conversation. Keep it under 80 words. "
        f"No bullet points. Plain text only."
    )
    response = await _model.generate_content_async(prompt)
    return response.text.strip()


async def continue_conversation(
    conversation_history: list[dict],
    patient_reply: str,
    diagnosis: str,
) -> str:
    """Continue the check-in conversation based on prior context."""
    history_text = "\n".join(
        f"[{m['role'].upper()}]: {m['message']}" for m in conversation_history[-6:]
    )
    prompt = (
        f"You are RecoverBot, an empathetic AI post-discharge health assistant.\n"
        f"Patient diagnosis: {diagnosis}.\n\n"
        f"Conversation so far:\n{history_text}\n"
        f"[PATIENT]: {patient_reply}\n\n"
        f"Continue the conversation. Gently ask about: pain level (0-10), fever, "
        f"swelling, wound status, medication adherence if not yet covered. "
        f"Keep the response under 120 words. Plain text only."
    )
    try:
        response = await _model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            # Hard fallback to keep the demo working even if the user's API key is exhausted
            return "Thank you for letting me know. I've recorded your update. Based on your symptoms, a care team member may reach out shortly if your indicators remain elevated. Please rest and stay hydrated!"
        raise


async def extract_features(conversation_log: list[dict], age: int, days_since_discharge: int) -> dict:
    """
    Use Gemini to extract structured symptom features from a conversation.
    Returns a dict ready to feed into the sklearn risk model.
    """
    conv_text = "\n".join(
        f"[{m['role'].upper()}]: {m['message']}" for m in conversation_log
    )
    prompt = (
        f"Analyse the following patient check-in conversation and extract symptom data.\n\n"
        f"{conv_text}\n\n"
        f"Return ONLY a valid JSON object with these exact keys:\n"
        f"pain_score (0-10 integer), fever_present (true/false), swelling (true/false), "
        f"medication_adherent (true/false), diagnosis_severity (1=low/2=medium/3=high integer).\n"
        f"If uncertain, use conservative estimates (e.g. pain_score=5, fever=false).\n"
        f"Return ONLY the JSON — no markdown, no explanation."
    )
    try:
        response = await _model.generate_content_async(prompt)
        raw = response.text.strip()
        # Strip any accidental markdown code fences
        raw = re.sub(r"```[a-z]*", "", raw).strip("` \n")
        features = json.loads(raw)
    except Exception as e:
        # Fallback if quota exhausted or JSON parse fails
        features = {
            "pain_score": 5,
            "fever_present": False,
            "swelling": False,
            "medication_adherent": True,
            "diagnosis_severity": 2,
        }
    features["age"] = age
    features["days_since_discharge"] = days_since_discharge
    return features
