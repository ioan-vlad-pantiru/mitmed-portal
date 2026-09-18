"""Trimitere SMS/WhatsApp — remindere de programare, printre altele.

Rămâne no-op (doar logare) până se completează TWILIO_* în .env. Twilio e
ales ca exemplu concret (are și SMS și WhatsApp prin același API); poate fi
înlocuit cu orice alt gateway SMS românesc fără să schimbi apelanții — toți
trec prin send_sms().
"""

import logging

from app.config import settings

logger = logging.getLogger("mitmed.notifications")


def _is_configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number)


def _redact_phone(phone: str) -> str:
    return f"***{phone[-4:]}" if len(phone) > 4 else "***"


def send_sms(to_phone: str, message: str) -> bool:
    if not _is_configured():
        # Nu logăm conținutul mesajului (poate menționa detalii ale
        # programării) — doar faptul că n-a fost trimis, cu numărul redactat.
        logger.info("Twilio neconfigurat — n-am trimis remindere către %s", _redact_phone(to_phone))
        return False

    import requests

    resp = requests.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
        auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        data={"From": settings.twilio_from_number, "To": to_phone, "Body": message},
        timeout=10,
    )
    if not resp.ok:
        logger.error("Twilio a răspuns %s pentru %s", resp.status_code, _redact_phone(to_phone))
        return False
    return True


def appointment_reminder_message(client_name: str, therapy_name: str, starts_at_local: str) -> str:
    return (
        f"Salut, {client_name}! Îți reamintim de programarea ta la MitMed "
        f"({therapy_name}) pe {starts_at_local}. Ne vedem curând!"
    )
