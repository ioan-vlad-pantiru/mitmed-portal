"""Verifică apărarea împotriva dublei-rezervări adăugată în
app/models.py (index unic parțial) + app/routers/appointments.py
(catch pe IntegrityError -> 409)."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.routers.appointments import _create_appointment


def _next_weekday_10am() -> datetime:
    dt = datetime.now(timezone.utc) + timedelta(days=1)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt.replace(hour=10, minute=0, second=0, microsecond=0)


def test_second_booking_for_same_slot_is_rejected(db_session, make_client_user, make_therapy):
    _, client_a = make_client_user(email="a@example.com")
    _, client_b = make_client_user(email="b@example.com")
    therapy = make_therapy()
    starts_at = _next_weekday_10am()

    appointment = _create_appointment(
        db_session,
        client_id=client_a.id,
        therapy_id=therapy.id,
        starts_at=starts_at,
        created_by_id=client_a.user_id,
    )
    assert appointment.id

    try:
        _create_appointment(
            db_session,
            client_id=client_b.id,
            therapy_id=therapy.id,
            starts_at=starts_at,
            created_by_id=client_b.user_id,
        )
        assert False, "a doua rezervare pe același slot ar fi trebuit respinsă"
    except HTTPException as exc:
        assert exc.status_code == 409


def test_same_time_different_therapy_is_allowed(db_session, make_client_user, make_therapy):
    """Terapii diferite se pot suprapune (mai mulți terapeuți) — indexul e pe
    (therapy_id, starts_at), nu doar pe starts_at."""
    _, client_a = make_client_user(email="a@example.com")
    _, client_b = make_client_user(email="b@example.com")
    therapy_a = make_therapy(name="Kinetoterapie")
    therapy_b = make_therapy(name="Masaj")
    starts_at = _next_weekday_10am()

    _create_appointment(
        db_session, client_id=client_a.id, therapy_id=therapy_a.id, starts_at=starts_at, created_by_id=client_a.user_id
    )
    appointment_b = _create_appointment(
        db_session, client_id=client_b.id, therapy_id=therapy_b.id, starts_at=starts_at, created_by_id=client_b.user_id
    )
    assert appointment_b.id


def test_cancelled_slot_can_be_rebooked(db_session, make_client_user, make_therapy):
    """Indexul unic e parțial (doar pe programări active) — un slot eliberat
    printr-o anulare trebuie să poată fi rezervat din nou."""
    from app.models import AppointmentStatus

    _, client_a = make_client_user(email="a@example.com")
    _, client_b = make_client_user(email="b@example.com")
    therapy = make_therapy()
    starts_at = _next_weekday_10am()

    first = _create_appointment(
        db_session, client_id=client_a.id, therapy_id=therapy.id, starts_at=starts_at, created_by_id=client_a.user_id
    )
    first.status = AppointmentStatus.ANULATA
    db_session.commit()

    second = _create_appointment(
        db_session, client_id=client_b.id, therapy_id=therapy.id, starts_at=starts_at, created_by_id=client_b.user_id
    )
    assert second.id
