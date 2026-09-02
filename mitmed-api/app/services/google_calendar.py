"""Sincronizare unidirecțională portal -> Google Calendar (contul folosit
acum de Sebastian pentru Google Calendar Appointment Schedule). Rămâne no-op
până primim un service account cu acces la acel calendar — vezi .env.example.

Fază 2, dacă e nevoie: sincronizare bidirecțională.
"""

from datetime import datetime, timedelta

from app.config import settings


def _is_configured() -> bool:
    return bool(
        settings.google_calendar_client_email
        and settings.google_calendar_private_key
        and settings.google_calendar_calendar_id
    )


def sync_appointment_created(*, summary: str, description: str, starts_at: datetime, duration_minutes: int) -> str | None:
    if not _is_configured():
        print("[google_calendar] neconfigurat — programarea nu e sincronizată cu Google Calendar.")
        return None

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    credentials = Credentials.from_service_account_info(
        {
            "client_email": settings.google_calendar_client_email,
            "private_key": settings.google_calendar_private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/calendar"],
    )
    service = build("calendar", "v3", credentials=credentials)
    ends_at = starts_at + timedelta(minutes=duration_minutes)

    event = (
        service.events()
        .insert(
            calendarId=settings.google_calendar_calendar_id,
            body={
                "summary": summary,
                "description": description,
                "start": {"dateTime": starts_at.isoformat()},
                "end": {"dateTime": ends_at.isoformat()},
            },
        )
        .execute()
    )
    return event.get("id")


def sync_appointment_cancelled(event_id: str | None) -> None:
    if not _is_configured() or not event_id:
        return

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    credentials = Credentials.from_service_account_info(
        {
            "client_email": settings.google_calendar_client_email,
            "private_key": settings.google_calendar_private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/calendar"],
    )
    service = build("calendar", "v3", credentials=credentials)
    try:
        service.events().delete(calendarId=settings.google_calendar_calendar_id, eventId=event_id).execute()
    except Exception as err:  # noqa: BLE001
        print(f"[google_calendar] nu am putut șterge evenimentul: {err}")
