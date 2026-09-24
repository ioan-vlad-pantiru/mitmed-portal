"""Job de remindere (app/scheduler.py) — două remindere distincte per
programare, cu o zi înainte și cu o oră înainte."""

from datetime import datetime, timedelta, timezone

from app.models import Appointment, AppointmentStatus
from app.scheduler import send_due_reminders


def _make_appointment(db_session, *, client, therapy, starts_at, status=AppointmentStatus.PROGRAMATA):
    appointment = Appointment(
        client_id=client.id,
        therapy_id=therapy.id,
        starts_at=starts_at,
        status=status,
        created_by_id=client.user_id,
    )
    db_session.add(appointment)
    db_session.commit()
    db_session.refresh(appointment)
    return appointment


def _capture_sent(monkeypatch):
    sent: list[tuple[str, str]] = []

    def fake_send_reminder(to_phone: str, *, when_label: str, **_kwargs) -> bool:
        sent.append((to_phone, when_label))
        return True

    monkeypatch.setattr("app.scheduler.send_appointment_reminder", fake_send_reminder)
    return sent


def test_sends_day_before_reminder_within_window(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    client.phone = "0722000111"
    db_session.commit()
    therapy = make_therapy()
    appointment = _make_appointment(
        db_session, client=client, therapy=therapy, starts_at=datetime.now(timezone.utc) + timedelta(hours=20)
    )

    send_due_reminders()

    db_session.refresh(appointment)
    assert appointment.reminder_day_before_sent_at is not None
    assert appointment.reminder_hour_before_sent_at is None  # e prea devreme pentru cel de-o-oră
    assert len(sent) == 1
    assert "mâine" in sent[0][1]


def test_sends_hour_before_reminder_within_window(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    client.phone = "0722000111"
    db_session.commit()
    therapy = make_therapy()
    appointment = _make_appointment(
        db_session, client=client, therapy=therapy, starts_at=datetime.now(timezone.utc) + timedelta(minutes=45)
    )

    send_due_reminders()

    db_session.refresh(appointment)
    assert appointment.reminder_hour_before_sent_at is not None
    # E și în fereastra de-o-zi (0-24h) — la prima trecere prin job, o
    # programare atât de apropiată primește ambele remindere deodată.
    assert appointment.reminder_day_before_sent_at is not None
    assert len(sent) == 2


def test_does_not_resend_already_sent_reminder(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    client.phone = "0722000111"
    db_session.commit()
    therapy = make_therapy()
    appointment = _make_appointment(
        db_session, client=client, therapy=therapy, starts_at=datetime.now(timezone.utc) + timedelta(minutes=45)
    )

    send_due_reminders()
    assert len(sent) == 2
    send_due_reminders()
    assert len(sent) == 2  # niciun reminder nou la a doua rulare


def test_ignores_appointments_outside_both_windows(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    client.phone = "0722000111"
    db_session.commit()
    therapy = make_therapy()
    appointment = _make_appointment(
        db_session, client=client, therapy=therapy, starts_at=datetime.now(timezone.utc) + timedelta(days=3)
    )

    send_due_reminders()

    db_session.refresh(appointment)
    assert appointment.reminder_day_before_sent_at is None
    assert appointment.reminder_hour_before_sent_at is None
    assert sent == []


def test_ignores_cancelled_appointments(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    client.phone = "0722000111"
    db_session.commit()
    therapy = make_therapy()
    _make_appointment(
        db_session,
        client=client,
        therapy=therapy,
        starts_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        status=AppointmentStatus.ANULATA,
    )

    send_due_reminders()

    assert sent == []


def test_marks_sent_even_without_phone_to_avoid_endless_retries(db_session, make_client_user, make_therapy, monkeypatch):
    sent = _capture_sent(monkeypatch)
    _, client = make_client_user(email="c@example.com")
    assert client.phone is None
    therapy = make_therapy()
    appointment = _make_appointment(
        db_session, client=client, therapy=therapy, starts_at=datetime.now(timezone.utc) + timedelta(minutes=30)
    )

    send_due_reminders()

    db_session.refresh(appointment)
    assert appointment.reminder_hour_before_sent_at is not None
    assert sent == []
