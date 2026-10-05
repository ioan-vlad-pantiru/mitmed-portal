"""Ștergerea terapiilor și pachetelor din catalog (routers/therapies.py,
routers/packages.py): cele nefolosite dispar de tot, cele cu istoric se
arhivează — ies din liste, dar istoricul rămâne intact."""

from datetime import datetime, timedelta, timezone

from app.models import Appointment, AppointmentStatus, Therapy, TherapyPackage


def _login(client):
    resp = client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    assert resp.status_code == 200, resp.text


def test_unused_therapy_is_deleted_for_good(client, db_session, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy(name="Nefolosită")
    _login(client)

    resp = client.delete(f"/therapies/{therapy.id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["archived"] is False
    db_session.expire_all()
    assert db_session.get(Therapy, therapy.id) is None


def test_therapy_with_paid_history_is_archived(client, db_session, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user()
    therapy = make_therapy(name="Masaj", price=100)
    _login(client)
    assert client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 100}).status_code == 200

    resp = client.delete(f"/therapies/{therapy.id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["archived"] is True
    assert client.get("/therapies").json() == []
    # Istoricul plăților își păstrează terapia.
    assert client.get(f"/clients/{profile.id}").json()["payments"][0]["therapy"]["name"] == "Masaj"
    # Nu mai poate fi reactivată sau ștearsă a doua oară.
    assert client.post(f"/therapies/{therapy.id}/toggle?active=true").status_code == 404
    assert client.delete(f"/therapies/{therapy.id}").status_code == 404


def test_therapy_with_upcoming_booking_cannot_be_deleted(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user()
    therapy = make_therapy()
    db_session.add(
        Appointment(
            client_id=profile.id,
            therapy_id=therapy.id,
            starts_at=datetime.now(timezone.utc) + timedelta(days=3),
            created_by_id=admin.id,
        )
    )
    db_session.commit()
    _login(client)

    resp = client.delete(f"/therapies/{therapy.id}")
    assert resp.status_code == 409
    assert "programare viitoare" in resp.json()["detail"]


def test_past_or_cancelled_bookings_do_not_block(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user()
    therapy = make_therapy()
    db_session.add_all(
        [
            Appointment(
                client_id=profile.id,
                therapy_id=therapy.id,
                starts_at=datetime.now(timezone.utc) - timedelta(days=3),
                created_by_id=admin.id,
                status=AppointmentStatus.FINALIZATA,
            ),
            Appointment(
                client_id=profile.id,
                therapy_id=therapy.id,
                starts_at=datetime.now(timezone.utc) + timedelta(days=3),
                created_by_id=admin.id,
                status=AppointmentStatus.ANULATA,
            ),
        ]
    )
    db_session.commit()
    _login(client)

    resp = client.delete(f"/therapies/{therapy.id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["archived"] is True


def test_therapy_in_live_package_is_blocked_until_package_is_deleted(client, db_session, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy(name="Masaj")
    _login(client)
    package = client.post(
        "/packages",
        json={"name": "Pachet Relax", "discount_percent": 10, "items": [{"therapy_id": therapy.id, "sessions_included": 5}]},
    )
    assert package.status_code == 200, package.text

    resp = client.delete(f"/therapies/{therapy.id}")
    assert resp.status_code == 409
    assert "Pachet Relax" in resp.json()["detail"]

    assert client.delete(f"/packages/{package.json()['id']}").status_code == 200
    assert client.delete(f"/therapies/{therapy.id}").status_code == 200


def test_therapy_only_on_a_fidelity_card_is_deleted_and_removed_from_the_card(
    client, db_session, make_admin_user, make_therapy
):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    masaj = make_therapy(name="Masaj")
    kineto = make_therapy(name="Kinetoterapie")
    _login(client)
    tiers = [{"session_number": 5, "discount_percent": 25}]
    client.post(
        "/fidelity-cards/types",
        json={"name": "Card", "therapies": [{"therapy_id": masaj.id, "tiers": tiers}, {"therapy_id": kineto.id, "tiers": tiers}]},
    )

    resp = client.delete(f"/therapies/{masaj.id}")
    assert resp.status_code == 200, resp.text
    card = client.get("/fidelity-cards/types").json()[0]
    assert [t["therapy_name"] for t in card["therapies"]] == ["Kinetoterapie"]


def test_sold_package_is_archived_and_purchase_kept(client, db_session, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user()
    therapy = make_therapy(name="Masaj")
    _login(client)
    package_id = client.post(
        "/packages",
        json={"name": "Pachet Relax", "discount_percent": 10, "items": [{"therapy_id": therapy.id, "sessions_included": 5}]},
    ).json()["id"]
    assert client.post("/payments", json={"client_id": profile.id, "package_id": package_id}).status_code == 200

    resp = client.delete(f"/packages/{package_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["archived"] is True
    assert client.get("/packages").json() == []
    payment = client.get(f"/clients/{profile.id}").json()["payments"][0]
    assert payment["package_name"] == "Pachet Relax"
    assert payment["package_total_sessions"] == 5
    # Un pachet arhivat nu se mai poate vinde.
    assert client.post("/payments", json={"client_id": profile.id, "package_id": package_id}).status_code == 422


def test_unsold_package_is_deleted_for_good(client, db_session, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)
    package_id = client.post(
        "/packages",
        json={"name": "Pachet", "discount_percent": 10, "items": [{"therapy_id": therapy.id, "sessions_included": 3}]},
    ).json()["id"]

    resp = client.delete(f"/packages/{package_id}")
    assert resp.status_code == 200
    assert resp.json()["archived"] is False
    db_session.expire_all()
    assert db_session.get(TherapyPackage, package_id) is None
