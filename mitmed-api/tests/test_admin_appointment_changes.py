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
