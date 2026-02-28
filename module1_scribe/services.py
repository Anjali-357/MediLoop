import os
import json
import logging
import asyncio
import tempfile
try:
    import ollama
    ollama_client = ollama.AsyncClient(host=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
except ImportError:
    ollama_client = None

logger = logging.getLogger(__name__)

# --- STT (Whisper) ---
try:
    import whisper
    # Load model synchronously on startup (might be slow first time)
    # In a prod setup, this would be loaded globally or injected
    whisper_model = whisper.load_model("base")
except ImportError:
    whisper_model = None
    logger.warning("openai-whisper not installed or could not be loaded")

async def process_audio_chunk(data: bytes, session_id: str) -> str:
    """Takes audio bytes, writes to a temp file, and transcribes using local Whisper."""
    if not whisper_model:
        return " [Transcribing...]"
        
    try:
        # WebRTC chunks from MediaRecorder are often webm
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
            f.write(data)
            temp_path = f.name
            
        # Transcribe runs synchronously; might block event loop if not careful, 
        # but for hackathon, direct call is acceptable or we run it in executor.
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, whisper_model.transcribe, temp_path)
        
        # Cleanup
        os.remove(temp_path)
        
        return result.get("text", "").strip()
    except Exception as e:
        logger.error(f"Whisper STT failed: {e}")
        return ""


# --- SOAP Note (Llama 3) ---
async def generate_soap_note(transcript: str) -> dict:
    """Generates a structured SOAP note from a transcript using Llama 3 via Ollama."""
    logger.info(f"==> Starting Llama3 SOAP Generation. Transcript length: {len(transcript)}")
    print(f"==> Starting Llama3 SOAP Generation. Transcript length: {len(transcript)}")
    
    prompt = f"""
You are a medical scribe. Read the following conversation transcript between a doctor and a patient, and generate a SOAP note.
Return ONLY valid JSON with exactly the keys: "subjective", "objective", "assessment", "plan". Do not include Markdown blocks or any other characters outside the JSON.
Transcript:
{transcript}
"""
    try:
        if not ollama_client:
            logger.warning("Ollama client not initialized. Returning mock SOAP note.")
            print("Ollama client not initialized. Returning mock SOAP note.")
            return {
                "subjective": "Mock Subjective...",
                "objective": "Mock Objective...",
                "assessment": "Mock Assessment...",
                "plan": "Mock Plan..."
            }
            
        logger.info("Calling Llama3 via Ollama for SOAP...")
        print("Calling Llama3 via Ollama for SOAP...")
        response = await ollama_client.generate(model='llama3', prompt=prompt)
        content = response.get('response', '').strip()
        logger.info(f"Llama3 SOAP API returned content length: {len(content)}")
        print(f"Llama3 SOAP API returned content length: {len(content)}")
        
        import re
        # Clean up markdown and extract JSON object
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            content = match.group(0)
            
        try:
            return json.loads(content.strip())
        except json.JSONDecodeError as de:
            logger.error(f"Failed to parse Llama3 SOAP JSON: {de}. Raw content: {content}")
            print(f"Failed to parse Llama3 SOAP JSON: {de}. Raw content: {content}")
            return {"subjective": "Error", "objective": "Error", "assessment": "Error", "plan": "Error"}
            
    except Exception as e:
        logger.error(f"Llama3 SOAP Generation failed: {e}")
        print(f"Llama3 SOAP Generation failed: {e}")
        return {
            "subjective": "Error generating note",
            "objective": "",
            "assessment": "",
            "plan": ""
        }

# --- ICD-10 Mapping (Llama 3 via Ollama) ---

async def map_icd_codes(text: str) -> list:
    """Maps Assessment + Plan text to top 3 ICD-10 codes using Llama 3."""
    logger.info(f"==> Starting Llama3 ICD-10 Mapping. Text length: {len(text)}")
    print(f"==> Starting Llama3 ICD-10 Mapping. Text length: {len(text)}")
    
    prompt = f"""
You are a medical coder. Map the following clinical text to the top 3 most relevant ICD-10 codes.
Return ONLY a valid JSON array of objects. Each object must have keys: "code", "description", "confidence".
Confidence should be a float between 0.0 and 1.0. Do not include markdown or other text.
Clinical Text:
{text}
"""
    try:
        if not ollama_client:
            logger.warning("Ollama client not initialized. Returning mock ICD-10.")
            print("Ollama client not initialized. Returning mock ICD-10.")
            return [{"code": "J06.9", "description": "Acute URI (Mock)", "confidence": 0.9}]
            
        logger.info("Calling Llama3 via Ollama...")
        print("Calling Llama3 via Ollama...")
        response = await ollama_client.generate(model='llama3', prompt=prompt)
        content = response.get('response', '').strip()
        
        logger.info(f"Llama3 returned content length: {len(content)}")
        print(f"Llama3 returned content length: {len(content)}")
        
        import re
        # Clean up markdown and extract JSON array
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            content = match.group(0)
            
        try:
            return json.loads(content.strip())
        except json.JSONDecodeError as de:
            logger.error(f"Failed to parse Llama3 JSON: {de}. Raw content: {content}")
            print(f"Failed to parse Llama3 JSON: {de}. Raw content: {content}")
            return [{"code": "ERR", "description": "Mapping failed", "confidence": 0.0}]
            
    except Exception as e:
        logger.error(f"Llama3 ICD Mapping failed: {e}")
        print(f"Llama3 ICD Mapping failed: {e}")
        return [
            {"code": "J06.9", "description": "Acute URI (Fallback)", "confidence": 0.91}
        ]
