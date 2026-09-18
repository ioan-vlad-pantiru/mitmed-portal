"""Job periodic: trimite remindere SMS pentru programările din următoarele
`reminder_hours_before` ore care nu au primit deja unul. Rulează o dată pe oră.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import SessionLocal
from app.models import Appointment, AppointmentStatus
from app.services.notifications import appointment_reminder_message, send_sms

logger = logging.getLogger("mitmed.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def send_due_reminders() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window_end = now + timedelta(hours=settings.reminder_hours_before)

        due = (
            db.query(Appointment)
            .filter(
                Appointment.status == AppointmentStatus.PROGRAMATA,
                Appointment.reminder_sent_at.is_(None),
                Appointment.starts_at >= now,
                Appointment.starts_at <= window_end,
            )
            .all()
        )

        for appointment in due:
            client = appointment.client
            therapy = appointment.therapy
            if not client.phone:
                continue

            message = appointment_reminder_message(
                client.full_name, therapy.name, appointment.starts_at.strftime("%d.%m.%Y %H:%M")
            )
            send_sms(client.phone, message)
            appointment.reminder_sent_at = now

        if due:
            db.commit()
            logger.info("remindere procesate pentru %d programări", len(due))
    except Exception:
        logger.exception("job de remindere eșuat")
        raise
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(send_due_reminders, "interval", hours=1, id="appointment_reminders", replace_existing=True)
    scheduler.start()
