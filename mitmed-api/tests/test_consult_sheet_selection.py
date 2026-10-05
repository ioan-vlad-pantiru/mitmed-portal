"""Fișa aleasă în ecranul de Consult: se leagă de programare, o finalizează, iar
ședința din pachet se scade o singură dată per programare."""

from datetime import datetime, timedelta, timezone

from app.models import Appointment, AppointmentStatus, Payment


def _login(client):
    resp = client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _setup(db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    therapy = make_therapy()
    package = Payment(
        client_id=profile.id, therapy_id=therapy.id, base_price=500, discount_amount=0, final_price=500,
        package_total_sessions=5, sessions_used=0,
    )
    appointment = Appointment(
        client_id=profile.id, therapy_id=therapy.id, created_by_id=admin.id,
        starts_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db_session.add_all([package, appointment])
    db_session.commit()
    return profile, therapy, package, appointment


def test_sheet_from_consult_completes_appointment_once(client, db_session, make_admin_user, make_client_user, make_therapy):
    profile, therapy, package, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client)

    resp = client.post("/consultation-sheets", json={"client_id": profile.id, "appointment_id": appointment.id})
    assert resp.status_code == 200, resp.text
    db_session.refresh(appointment)
    db_session.refresh(package)
    assert appointment.status == AppointmentStatus.FINALIZATA
    assert package.sessions_used == 1

    # Notițele de tratament pentru aceeași programare nu mai scad o ședință.
    resp = client.post(
        "/medical-records",
        json={"client_id": profile.id, "appointment_id": appointment.id, "therapy_id": therapy.id, "notes": "Masaj"},
    )
    assert resp.status_code == 200, resp.text
    db_session.refresh(package)
    assert package.sessions_used == 1


def test_consult_data_offers_last_sheet_values(client, db_session, make_admin_user, make_client_user, make_therapy):
    profile, _, _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client)
    field = client.post("/consultation-sheets/fields", json={"label": "Antecedente", "carry_over": True}).json()["id"]
    client.post("/consultation-sheets", json={"client_id": profile.id, "values": {field: "HTA"}})

    data = client.get(f"/appointments/{appointment.id}/consult").json()
    assert data["latest_sheet_values"]["consultatie"] == {field: "HTA"}
    assert data["appointment"]["therapy"]["is_consultation"] is False


def test_sheet_rejects_other_clients_appointment(client, db_session, make_admin_user, make_client_user, make_therapy):
    _, _, _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _, other = make_client_user(email="altul@example.com")
    _login(client)
    resp = client.post("/consultation-sheets", json={"client_id": other.id, "appointment_id": appointment.id})
    assert resp.status_code == 422
