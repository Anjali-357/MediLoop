"""
module2_recoverbot/services/twilio_service.py
WhatsApp/SMS messaging via Twilio.
"""
import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
_FROM = os.getenv("TWILIO_PHONE_NUMBER", "whatsapp:+14155238886")

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(_ACCOUNT_SID, _AUTH_TOKEN)
    return _client


def send_whatsapp(to_number: str, body: str) -> str:
    """
    Send a WhatsApp message via Twilio Sandbox.
    to_number should be in E.164 format, e.g. +919876543210
    Returns the Twilio message SID.
    """
    client = _get_client()
    to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    message = client.messages.create(
        from_=_FROM,
        to=to,
        body=body,
    )
    return message.sid


def send_sms(to_number: str, body: str) -> str:
    """Send a plain SMS. Returns Twilio message SID."""
    client = _get_client()
    message = client.messages.create(
        from_=_FROM.replace("whatsapp:", ""),
        to=to_number,
        body=body,
    )
    return message.sid
