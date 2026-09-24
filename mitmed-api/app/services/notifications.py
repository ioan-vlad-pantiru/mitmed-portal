"""Trimitere WhatsApp (Meta WhatsApp Business Cloud API) — remindere de
programare și coduri de verificare la înregistrare.

Rămâne no-op (doar logare) până se completează WHATSAPP_PHONE_NUMBER_ID și
WHATSAPP_ACCESS_TOKEN în .env. Mesajele inițiate de noi (nu răspunsuri în
fereastra de 24h) pot fi DOAR template-uri aprobate în WhatsApp Manager —
textul lor e fixat acolo, aici trimitem doar valorile variabilelor, în ordinea
{{1}}, {{2}}, ... din template.
"""

import logging

from app.config import settings

logger = logging.getLogger("mitmed.notifications")


def _is_configured() -> bool:
    return bool(settings.whatsapp_phone_number_id and settings.whatsapp_access_token)


def _redact_phone(phone: str) -> str:
    return f"***{phone[-4:]}" if len(phone) > 4 else "***"


def to_whatsapp_number(phone: str) -> str:
    """WhatsApp vrea numărul în format internațional, doar cifre (fără "+").
    Pe fișe numerele sunt scrise cum le-a tastat clientul/recepția — de obicei
    format național românesc (07xx...), pe care îl prefixăm cu 40."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("00"):
        return digits[2:]
    if digits.startswith("0"):
        return "40" + digits[1:]
    return digits


def _text_params(*values: str) -> list[dict]:
    return [{"type": "text", "text": value} for value in values]


def send_whatsapp_template(to_phone: str, template_name: str, components: list[dict]) -> bool:
    if not _is_configured():
        # Nu logăm variabilele (pot conține codul sau detalii ale
        # programării) — doar faptul că n-a fost trimis, cu numărul redactat.
        logger.info("WhatsApp neconfigurat — n-am trimis %s către %s", template_name, _redact_phone(to_phone))
        return False

    import requests

    try:
        resp = requests.post(
            f"https://graph.facebook.com/{settings.whatsapp_graph_api_version}/"
            f"{settings.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_whatsapp_number(to_phone),
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": settings.whatsapp_template_language},
                    "components": components,
                },
            },
            timeout=10,
        )
    except requests.RequestException:
        logger.exception("WhatsApp indisponibil pentru %s", _redact_phone(to_phone))
        return False
    if not resp.ok:
        # Corpul erorii Meta conține doar cod/mesaj de eroare, fără datele trimise.
        logger.error("WhatsApp a răspuns %s pentru %s: %s", resp.status_code, _redact_phone(to_phone), resp.text[:500])
        return False
    return True


def send_otp(to_phone: str, code: str) -> bool:
    """Template de categorie AUTHENTICATION cu buton "Copy code" — Meta cere
    codul de două ori: în corp ({{1}}) și ca parametru al butonului."""
    return send_whatsapp_template(
        to_phone,
        settings.whatsapp_otp_template,
        [
            {"type": "body", "parameters": _text_params(code)},
            {"type": "button", "sub_type": "url", "index": "0", "parameters": _text_params(code)},
        ],
    )


def send_appointment_reminder(
    to_phone: str, *, client_name: str, therapy_name: str, starts_at_local: str, when_label: str
) -> bool:
    """Template de categorie UTILITY. `when_label` e fraza care spune CÂND e
    programarea față de acum — ex. "mâine" pentru reminderul cu o zi înainte,
    "într-o oră" pentru cel cu o oră înainte (vezi app/scheduler.py).

    Ordinea variabilelor trebuie să corespundă template-ului din WhatsApp
    Manager: {{1}} nume, {{2}} când, {{3}} terapie, {{4}} data și ora,
    {{5}} adresa, {{6}} link Google Maps."""
    return send_whatsapp_template(
        to_phone,
        settings.whatsapp_reminder_template,
        [
            {
                "type": "body",
                "parameters": _text_params(
                    client_name,
                    when_label,
                    therapy_name,
                    starts_at_local,
                    settings.clinic_address,
                    settings.clinic_directions_url,
                ),
            }
        ],
    )
