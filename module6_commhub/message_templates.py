"""
module6_commhub/message_templates.py
All WhatsApp message templates in one place.
"""


def welcome_new_patient(name: str, frontend_url: str) -> str:
    base = frontend_url.rstrip("/")
    return (
        f"👋 Hi {name}, welcome to *MediLoop* care support!\n\n"
        "We're here to support your health journey. Here's what you can do:\n\n"
        f"1️⃣ *Recovery Check-In* — {base}/recoverbot\n"
        f"2️⃣ *Pain Assessment* — {base}/painscan\n"
        f"3️⃣ *Care Reminders* — {base}/caregap\n\n"
        "Reply anytime and our AI will guide you. 🏥"
    )


def welcome_returning(name: str) -> str:
    return (
        f"👋 Welcome back, *{name}*!\n\n"
        "How can we help you today?\n"
        "- Type your symptoms or question\n"
        "- Our AI will route you to the right care module automatically"
    )


def followup_flagged(name: str, risk_label: str) -> str:
    emoji = "🚨" if risk_label in ("HIGH", "CRITICAL") else "⚠️"
    return (
        f"{emoji} *MediLoop Alert — {name}*\n\n"
        f"Your follow-up status has been flagged as *{risk_label} RISK*.\n"
        "A care team member has been notified and will reach out shortly.\n\n"
        "If you're experiencing a medical emergency, please call *112* immediately."
    )


def painscan_link(patient_name: str, link: str, is_caregiver: bool = True) -> str:
    subject = f"your child *{patient_name}*" if is_caregiver else f"*{patient_name}*"
    return (
        f"🩺 *MediLoop PainScan*\n\n"
        f"Our system detected that {subject} may be in discomfort.\n\n"
        "Please open the PainScan tool to complete a quick video-based pain assessment:\n"
        f"🔗 {link}\n\n"
        "It takes under 2 minutes and helps our care team assess pain level accurately. "
        "Results are reviewed immediately. 💙"
    )


def recoverbot_prompt(name: str, link: str) -> str:
    return (
        f"📋 *MediLoop — Recovery Check-In for {name}*\n\n"
        "It's time for your recovery update! Please answer a few quick questions "
        "so our team can monitor your progress:\n"
        f"🔗 {link}\n\n"
        "Or simply reply to this message with how you're feeling today."
    )


def caregap_outreach(name: str, gap_type: str, custom_msg: str = "") -> str:
    if custom_msg:
        return custom_msg
    gap_readable = gap_type.replace("_", " ").title()
    return (
        f"👋 Hi *{name}*, this is a gentle reminder from MediLoop.\n\n"
        f"⚠️ We noticed a *{gap_readable}* in your care plan.\n\n"
        "Please schedule a visit with your doctor at the earliest. "
        "Early attention prevents bigger health issues. 🏥\n\n"
        "Reply to this message if you have any questions."
    )


def manual_message(body: str) -> str:
    return f"💬 *MediLoop Care Team*\n\n{body}"
