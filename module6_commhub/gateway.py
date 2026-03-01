"""
module6_commhub/gateway.py
The ONE place in MediLoop that calls Twilio.
All modules must use this instead of calling Twilio directly.
"""
import os
from twilio.rest import Client

_client = None

def _get_client() -> Client:
    global _client
    if _client is None:
        sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        token = os.getenv("TWILIO_AUTH_TOKEN", "")
        _client = Client(sid, token)
    return _client

FROM_NUMBER = "whatsapp:+14155238886"  # Twilio Sandbox


def send_whatsapp(to: str, body: str) -> bool:
    """Send a plain WhatsApp message. Returns True on success."""
    try:
        to_fmt = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
        msg = _get_client().messages.create(from_=FROM_NUMBER, body=body, to=to_fmt)
        print(f"[CommHub] Sent to {to_fmt} | SID: {msg.sid}")
        return True
    except Exception as e:
        print(f"[CommHub] Send failed to {to}: {e}")
        return False


def send_with_link(to: str, body: str, link: str) -> bool:
    """Send a WhatsApp message with a prominent link appended."""
    full_body = f"{body}\n\n🔗 {link}"
    return send_whatsapp(to, full_body)
