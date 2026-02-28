import os
from twilio.rest import Client

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "dummy")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "dummy")

def send_whatsapp_message(to_number: str, message: str) -> bool:
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        # Using Twilio Sandbox number for testing, or standard if configured
        from_number = 'whatsapp:+14155238886' 
        
        # Ensure number has whatsapp: prefix
        to = to_number if to_number.startswith('whatsapp:') else f'whatsapp:{to_number}'
        
        msg = client.messages.create(
            from_=from_number,
            body=message,
            to=to
        )
        print(f"Message sent to {to}, SID: {msg.sid}")
        return True
    except Exception as e:
        print(f"Error sending WhatsApp to {to_number}: {e}")
        return False
