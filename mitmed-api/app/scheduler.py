"""Job periodic: trimite remindere WhatsApp pentru programările apropiate care nu
au primit deja unul. Două remindere distincte per programare — cu o zi
înainte și cu o oră înainte (vezi REMINDER_DAY_BEFORE_HOURS/
REMINDER_HOUR_BEFORE_HOURS în config). Rulează la fiecare 5 minute — mult mai
des decât e necesar pentru reminderul de-o-zi, dar e fereastra care contează
pentru cel de-o-oră: la un interval orar, "cu o oră înainte" ar putea ajunge
oricând între 0 și 2 ore înainte, ceea ce nu mai e o oră.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm.attributes import InstrumentedAttribute

from app.config import settings
from app.database import SessionLocal
from app.models import Appointment, AppointmentStatus, PendingRegistration
from app.services.notifications import format_local, send_appointment_reminder

logger = logging.getLogger("mitmed.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def _send_reminder_batch(
    db,
    *,
    now: datetime,
    hours_before: int,
    sent_at_column: InstrumentedAttribute,
    sent_at_field: str,
    when_label: str,
) -> int:
    window_end = now + timedelta(hours=hours_before)

    due = (
        db.query(Appointment)
        .filter(
            Appointment.status == AppointmentStatus.PROGRAMATA,
            sent_at_column.is_(None),
            Appointment.starts_at >= now,
            Appointment.starts_at <= window_end,
        )
        .all()
    )

    for appointment in due:
        client = appointment.client
        therapy = appointment.therapy
        if client.phone:
            send_appointment_reminder(
                client.phone,
                client_name=client.full_name,
                therapy_name=therapy.name,
                starts_at_local=format_local(appointment.starts_at),
                when_label=when_label,
            )
        # Marcat ca trimis chiar și fără telefon pe fișă — altfel job-ul ar
        # reîncerca la nesfârșit o programare care n-are cum să primească reminderul.
        setattr(appointment, sent_at_field, now)

    if due:
        db.commit()
    return len(due)


def send_due_reminders() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        day_before_count = _send_reminder_batch(
            db,
            now=now,
            hours_before=settings.reminder_day_before_hours,
            sent_at_column=Appointment.reminder_day_before_sent_at,
            sent_at_field="reminder_day_before_sent_at",
            when_label="mâine",
        )
        hour_before_count = _send_reminder_batch(
            db,
            now=now,
            hours_before=settings.reminder_hour_before_hours,
            sent_at_column=Appointment.reminder_hour_before_sent_at,
            sent_at_field="reminder_hour_before_sent_at",
            when_label="într-o oră",
        )

        if day_before_count or hour_before_count:
            logger.info(
                "remindere procesate: %d cu o zi înainte, %d cu o oră înainte", day_before_count, hour_before_count
            )
    except Exception:
        logger.exception("job de remindere eșuat")
        raise
    finally:
        db.close()


def cleanup_expired_pending_registrations() -> None:
    """Șterge auto-înregistrările abandonate (cod niciodată introdus) — conțin
    date personale (nume, telefon, data nașterii, hash de parolă) care n-au
    ce căuta în bază după ce codul de verificare a expirat."""
    db = SessionLocal()
    try:
        deleted = (
            db.query(PendingRegistration)
            .filter(PendingRegistration.expires_at < datetime.now(timezone.utc))
            .delete(synchronize_session=False)
        )
        if deleted:
            db.commit()
            logger.info("șterse %d auto-înregistrări expirate, neconfirmate", deleted)
    except Exception:
        logger.exception("curățarea auto-înregistrărilor expirate a eșuat")
        raise
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(send_due_reminders, "interval", minutes=5, id="appointment_reminders", replace_existing=True)
    scheduler.add_job(
        cleanup_expired_pending_registrations, "interval", hours=1, id="pending_registrations_cleanup", replace_existing=True
    )
    scheduler.start()
