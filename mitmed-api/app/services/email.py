"""Trimitere email prin SMTP — deocamdată doar link-urile de resetare a
parolei. Rămâne no-op (doar logare) până se completează SMTP_HOST și
SMTP_FROM în .env, la fel ca services/notifications.py pentru WhatsApp."""

import html as html_lib
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("mitmed.email")


def _redact_email(address: str) -> str:
    local, _, domain = address.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    if not (settings.smtp_host and settings.smtp_from):
        # Nu logăm corpul — conține link-ul de resetare.
        logger.info("SMTP neconfigurat — n-am trimis „%s” către %s", subject, _redact_email(to))
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=15)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            server.starttls(context=context)
        with server:
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except (smtplib.SMTPException, OSError):
        logger.exception("Email netrimis către %s", _redact_email(to))
        return False
    return True


def send_password_reset(to: str, *, name: str | None, reset_url: str, valid_minutes: int) -> bool:
    greeting = f"Bună, {name}," if name else "Bună,"
    text = (
        f"{greeting}\n\n"
        "Am primit o cerere de resetare a parolei pentru contul tău MitMed.\n"
        f"Deschide link-ul de mai jos ca să alegi o parolă nouă (valabil {valid_minutes} de minute):\n\n"
        f"{reset_url}\n\n"
        "Dacă nu tu ai cerut resetarea, ignoră acest email — parola ta rămâne neschimbată.\n\n"
        "Echipa MitMed"
    )
    safe_greeting = html_lib.escape(greeting)
    html = f"""\
<p>{safe_greeting}</p>
<p>Am primit o cerere de resetare a parolei pentru contul tău MitMed.</p>
<p><a href="{reset_url}" style="display:inline-block;padding:10px 18px;background:#005f60;color:#ffffff;
border-radius:8px;text-decoration:none;font-weight:600">Alege o parolă nouă</a></p>
<p style="color:#666;font-size:13px">Link-ul e valabil {valid_minutes} de minute. Dacă butonul nu merge, copiază
adresa în browser:<br>{reset_url}</p>
<p style="color:#666;font-size:13px">Dacă nu tu ai cerut resetarea, ignoră acest email — parola ta rămâne
neschimbată.</p>
<p>Echipa MitMed</p>
"""
    return send_email(to, "Resetarea parolei MitMed", text, html)
