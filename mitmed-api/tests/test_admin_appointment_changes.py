"""Adminul poate anula, reprograma sau șterge o programare oricând (inclusiv
sub 48h); recepția și clientul rămân la regula de 48h."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.models import Appointment, AppointmentStatus, MedicalRecord, Payment, PaymentStatus

CLINIC_TIMEZONE = ZoneInfo("Europe/Bucharest")


def _login(client, email):
    resp = client.post("/auth/login", json={"identifier": email, "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _appointment_in(db_session, profile, therapy, delta: timedelta, created_by_id: str) -> Appointment:
    appointment = Appointment(
        client_id=profile.id,
        therapy_id=therapy.id,
        starts_at=datetime.now(timezone.utc) + delta,
        created_by_id=created_by_id,
    )
    db_session.add(appointment)
    db_session.commit()
    return appointment


def _weekday_far_ahead(hour: int) -> datetime:
    dt = datetime.now(CLINIC_TIMEZONE) + timedelta(days=7)
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt.replace(hour=hour, minute=0, second=0, microsecond=0)


def test_admin_can_cancel_within_48h(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    appointment = _appointment_in(db_session, profile, make_therapy(), timedelta(hours=1), admin.id)
    _login(client, "admin@example.com")

    resp = client.post(f"/appointments/{appointment.id}/cancel")
    assert resp.status_code == 200, resp.text
    db_session.refresh(appointment)
    assert appointment.status == AppointmentStatus.ANULATA


def test_reception_still_bound_by_48h(client, db_session, make_admin_user, make_client_user, make_therapy):
    reception = make_admin_user(email="receptie@example.com", role="RECEPTIE")
    _, profile = make_client_user()
    appointment = _appointment_in(db_session, profile, make_therapy(), timedelta(hours=1), reception.id)
    _login(client, "receptie@example.com")

    assert client.post(f"/appointments/{appointment.id}/cancel").status_code == 422
    assert client.put(f"/appointments/{appointment.id}", json={"starts_at": _weekday_far_ahead(10).isoformat()}).status_code == 403
    assert client.delete(f"/appointments/{appointment.id}").status_code == 403


def test_admin_reschedules_appointment(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    appointment = _appointment_in(db_session, profile, make_therapy(), timedelta(hours=1), admin.id)
    appointment.reminder_hour_before_sent_at = datetime.now(timezone.utc)
    db_session.commit()
    _login(client, "admin@example.com")

    new_start = _weekday_far_ahead(11)
    resp = client.put(f"/appointments/{appointment.id}", json={"starts_at": new_start.isoformat()})
    assert resp.status_code == 200, resp.text
    db_session.refresh(appointment)
    assert appointment.starts_at == new_start
    assert appointment.reminder_hour_before_sent_at is None

    # Programul cabinetului se respectă și la reprogramare.
    resp = client.put(f"/appointments/{appointment.id}", json={"starts_at": _weekday_far_ahead(7).isoformat()})
    assert resp.status_code == 422


def test_admin_deletes_appointment_and_its_unpaid_payment(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    therapy = make_therapy()
    appointment = _appointment_in(db_session, profile, therapy, timedelta(hours=1), admin.id)
    db_session.add(
        Payment(
            client_id=profile.id, therapy_id=therapy.id, appointment_id=appointment.id,
            base_price=100, discount_amount=0, final_price=100, status=PaymentStatus.NEPLATIT,
        )
    )
    db_session.commit()
    appointment_id = appointment.id
    _login(client, "admin@example.com")

    resp = client.delete(f"/appointments/{appointment_id}")
    assert resp.status_code == 200, resp.text
    db_session.expire_all()
    assert db_session.get(Appointment, appointment_id) is None
    assert db_session.query(Payment).count() == 0


def test_documented_appointment_cannot_be_deleted(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    appointment = _appointment_in(db_session, profile, make_therapy(), timedelta(hours=1), admin.id)
    db_session.add(MedicalRecord(client_id=profile.id, author_id=admin.id, appointment_id=appointment.id, notes="Masaj"))
    db_session.commit()
    _login(client, "admin@example.com")

    assert client.delete(f"/appointments/{appointment.id}").status_code == 409


def test_client_cancellation_notifies_medic_and_shows_on_board(
    client, db_session, make_admin_user, make_client_user, make_therapy, monkeypatch
):
    from app.config import settings
    from app.routers import appointments as appointments_router

    sent: list[dict] = []
    monkeypatch.setattr(appointments_router, "send_cancellation_notice", lambda **kw: sent.append(kw))
    monkeypatch.setattr(settings, "staff_notify_phone", "0722000000")
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user(email="pacient@example.com", full_name="Ana Pop")
    profile.phone = "0733111222"
    db_session.commit()
    therapy = make_therapy(name="Masaj")
    starts_at = datetime(2030, 3, 4, 8, 30, tzinfo=timezone.utc)  # 10:30 ora României
    appointment = Appointment(client_id=profile.id, therapy_id=therapy.id, starts_at=starts_at, created_by_id=admin.id)
    db_session.add(appointment)
    db_session.commit()

    _login(client, "pacient@example.com")
    assert client.post(f"/appointments/{appointment.id}/cancel/me").status_code == 200
    assert sent == [
        {"client_name": "Ana Pop", "client_phone": "0733111222", "therapy_name": "Masaj", "starts_at_local": "04.03.2030 10:30"}
    ]
    client.post("/auth/logout")

    _login(client, "admin@example.com")
    rows = client.get("/appointments/cancelled-by-clients").json()
    assert [r["client_name"] for r in rows] == ["Ana Pop"]


def test_board_lists_recent_bookings_with_booking_time(client, db_session, make_admin_user, make_client_user, make_therapy):
    """Momentul rezervării (nu doar data ședinței) și cine a făcut-o — vizibile
    pe bord, în calendar și pe fișa clientului."""
    admin = make_admin_user(email="admin@example.com")
    user, profile = make_client_user(email="pacient@example.com", full_name="Ana Pop")
    therapy = make_therapy(name="Masaj")
    old = _appointment_in(db_session, profile, therapy, timedelta(days=20), admin.id)
    old.created_at = datetime.now(timezone.utc) - timedelta(days=10)
    by_staff = _appointment_in(db_session, profile, therapy, timedelta(days=3), admin.id)
    by_client = _appointment_in(db_session, profile, therapy, timedelta(days=5), user.id)
    db_session.commit()

    _login(client, "admin@example.com")
    rows = client.get("/appointments/recently-booked").json()
    assert [(r["id"], r["booked_by_client"]) for r in rows] == [(by_client.id, True), (by_staff.id, False)]
    assert rows[0]["booked_at"] is not None

    start = (datetime.now(timezone.utc)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    calendar = {a["id"]: a for a in client.get("/appointments", params={"start": start, "end": end}).json()}
    assert calendar[by_client.id]["booked_by_client"] is True
    assert calendar[old.id]["booked_at"].startswith(old.created_at.date().isoformat())

    detail = client.get(f"/clients/{profile.id}").json()
    assert {a["id"]: a["booked_by_client"] for a in detail["appointments"]}[by_staff.id] is False
