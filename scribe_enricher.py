"""
scribe_enricher.py
Listens for consultation.completed → Gemini-generates a 1-2 line summary_short
and patches it onto the consultation document.
"""
import os
import asyncio
import google.generativeai as genai
from shared.database import db
from shared.events import subscribe
from bson import ObjectId

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
_model = genai.GenerativeModel("gemini-2.5-flash")


async def generate_summary(transcript: str, soap_note: dict) -> str:
    """Generate a 1-2 line clinical summary from transcript + SOAP."""
    assessment = soap_note.get("assessment", "")
    plan = soap_note.get("plan", "")
    prompt = (
        f"You are a clinical summarizer. Summarize this consultation in 1-2 sentences "
        f"for a doctor's quick reference. Be clinical and concise.\n\n"
        f"Assessment: {assessment}\nPlan: {plan}\n"
        f"Transcript excerpt: {transcript[:400]}\n\n"
        "Output only the summary sentence(s). No preamble."
    )
    try:
        resp = await _model.generate_content_async(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"[ScribeEnricher] Gemini error: {e}")
        return f"{assessment[:120]}..." if assessment else ""


async def start_enricher():
    """Subscribe to consultation.completed and enrich with summary_short."""
    print("[ScribeEnricher] Listening for consultation.completed...")
    async for event in subscribe("consultation.completed"):
        try:
            consultation_id = event.get("consultation_id")
            if not consultation_id:
                continue

            doc = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
            if not doc:
                continue

            # Skip if already enriched
            if doc.get("summary_short"):
                continue

            transcript = doc.get("transcript", "")
            soap_note = doc.get("soap_note", {})

            summary = await generate_summary(transcript, soap_note)

            await db.consultations.update_one(
                {"_id": ObjectId(consultation_id)},
                {"$set": {"summary_short": summary}}
            )
            print(f"[ScribeEnricher] Enriched {consultation_id}: '{summary[:60]}...'")
        except Exception as e:
            print(f"[ScribeEnricher] Error: {e}")
