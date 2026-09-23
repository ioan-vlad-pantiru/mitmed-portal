"""Verifică apărarea împotriva dublei-rezervări adăugată în
app/models.py (index unic parțial) + app/routers/appointments.py
(catch pe IntegrityError -> 409)."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.routers.appointments import _create_appointment, _ensure_own_slot_is_available

CLINIC_TIMEZONE = ZoneInfo("Europe/Bucharest")


def _next_weekday_10am() -> datetime:
    dt = datetime.now(timezone.utc) + timedelta(days=1)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt.replace(hour=10, minute=0, second=0, microsecond=0)


def _next_weekday_at_local(hour: int, minute: int = 0) -> datetime:
    """La fel ca `_next_weekday_10am`, dar în ora locală a clinicii — necesar
    când testul verifică o oră apropiată de limitele 10:00/18:00, ca
    decalajul UTC/Europe-Bucharest să nu strice comparația."""
    dt = datetime.now(CLINIC_TIMEZONE) + timedelta(days=1)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0)


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


def _far_weekday_at_local(hour: int, minute: int = 0) -> datetime:
    """Cu 3 zile în avans, ca testele de prag de 24h să nu depindă de ora la
    care rulează suita (evită flaky-ul unui '+1 zi' care poate cădea sub 24h
    dacă testul rulează după-amiaza)."""
    dt = datetime.now(CLINIC_TIMEZONE) + timedelta(days=3)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0)


def test_own_booking_less_than_24h_ahead_is_rejected(db_session, make_therapy):
    """Auto-programarea din portal cere minim 24h — recepția rămâne exceptată
    (vezi `_create_appointment` fără `enforce_live_availability`, testat mai
    sus la orele de program)."""
    therapy = make_therapy()
    starts_at = datetime.now(timezone.utc) + timedelta(hours=2)

    try:
        _ensure_own_slot_is_available(db_session, starts_at=starts_at, therapy=therapy)
        assert False, "auto-programarea sub 24h ar fi trebuit respinsă"
    except HTTPException as exc:
        assert exc.status_code == 422


def test_own_booking_at_least_24h_ahead_is_allowed(db_session, make_client_user, make_therapy):
    _, client_a = make_client_user(email="a@example.com")
    therapy = make_therapy()
    starts_at = _far_weekday_at_local(10)

    appointment = _create_appointment(
        db_session,
        client_id=client_a.id,
        therapy_id=therapy.id,
        starts_at=starts_at,
        created_by_id=client_a.user_id,
        enforce_live_availability=True,
    )
    assert appointment.id


def test_appointment_ending_after_closing_time_is_rejected(db_session, make_client_user, make_therapy):
    """Programul e 10:00-18:00 — o ședință de 60 min care ar începe la 17:30
    s-ar termina la 18:30, deci trebuie respinsă chiar dacă vine din admin
    (nu doar din auto-programarea clientului)."""
    _, client_a = make_client_user(email="a@example.com")
    therapy = make_therapy(duration_minutes=60)
    starts_at = _next_weekday_at_local(17, 30)

    try:
        _create_appointment(
            db_session, client_id=client_a.id, therapy_id=therapy.id, starts_at=starts_at, created_by_id=client_a.user_id
        )
        assert False, "programarea ar fi trebuit respinsă — se termină după ora 18:00"
    except HTTPException as exc:
        assert exc.status_code == 422


def test_appointment_before_opening_time_is_rejected(db_session, make_client_user, make_therapy):
    _, client_a = make_client_user(email="a@example.com")
    therapy = make_therapy()
    starts_at = _next_weekday_at_local(9)

    try:
        _create_appointment(
            db_session, client_id=client_a.id, therapy_id=therapy.id, starts_at=starts_at, created_by_id=client_a.user_id
        )
        assert False, "programarea ar fi trebuit respinsă — clinica deschide la 10:00"
    except HTTPException as exc:
        assert exc.status_code == 422


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
