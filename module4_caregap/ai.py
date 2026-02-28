import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "dummy"))

def draft_outreach_message(patient_name: str, patient_age: int, diagnosis: str, gap_type: str, language: str) -> str:
    prompt = f"""
    Draft a short, friendly WhatsApp message (under 200 characters) to a patient.
    Language: {language}
    Patient Name: {patient_name}
    Age: {patient_age}
    Diagnosis: {diagnosis}
    Care Gap Type: {gap_type}
    
    The message should gently remind them about their {gap_type} care gap. Keep it professional but empathetic.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error drafting message for {patient_name}: {e}")
        return f"Hi {patient_name}, please schedule a visit regarding your {gap_type}. Our doctors are here to help!"
