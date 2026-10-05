"""O plată pentru mai multe terapii odată (routers/payments.py:create_multi_payment)
— fiecare linie devine un Payment, cu reducerea de fidelitate calculată în
ordine, ca și cum ședințele ar fi fost plătite una după alta."""

from datetime import datetime, timedelta, timezone

from app.models import Appointment, AppointmentStatus, Payment, PaymentStatus


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _setup(make_admin_user, make_client_user, make_therapy, client):
    admin = make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    user, profile = make_client_user(email="c@example.com", password="parola123")
    masaj = make_therapy(name="Masaj", price=100)
    kineto = make_therapy(name="Kinetoterapie", price=200)
    _login(client)
    return admin, user, profile, masaj, kineto


def _issue_card(client, profile, therapy_ids, tiers):
    resp = client.post("/fidelity-cards/types", json={"name": "Card", "therapy_ids": therapy_ids, "tiers": tiers})
    assert resp.status_code == 200, resp.text
    resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": resp.json()["id"]})
    assert resp.status_code == 201, resp.text


def _stamps(client, profile):
    return client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]["stamps"]


def test_total_accounts_for_fidelity_position_of_each_line(client, make_admin_user, make_client_user, make_therapy):
    """Card doar pe masaj, -50% la a 2-a ședință. Două masaje + un kineto
    într-o singură plată: al doilea masaj primește reducerea, chiar dacă
    înainte de plată cardul era la prima ședință; kineto nu contează."""
    _, _, profile, masaj, kineto = _setup(make_admin_user, make_client_user, make_therapy, client)
    _issue_card(client, profile, [masaj.id], [{"session_number": 2, "discount_percent": 50}])
    payload = {
        "client_id": profile.id,
        "lines": [{"therapy_id": masaj.id}, {"therapy_id": kineto.id}, {"therapy_id": masaj.id}],
    }

    preview = client.post("/payments/multi/preview", json=payload)
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert [float(line["final_price"]) for line in body["lines"]] == [100, 200, 50]
    assert body["lines"][2]["fidelity_discount_percent"] == "50.00"
    assert float(body["final_price"]) == 350
    assert float(body["discount_amount"]) == 50

    resp = client.post("/payments/multi", json={**payload, "amount_paid": 350})
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["ids"]) == 3
    payments = client.get(f"/clients/{profile.id}").json()["payments"]
    assert sorted(float(p["final_price"]) for p in payments) == [50, 100, 200]
    assert all(p["status"] == "PLATIT" for p in payments)
    # Ciclul de 2 s-a încheiat — cardul revine la 0.
    assert _stamps(client, profile) == 0


def test_partial_amount_fills_lines_in_order(client, make_admin_user, make_client_user, make_therapy):
    _, _, profile, masaj, kineto = _setup(make_admin_user, make_client_user, make_therapy, client)
    _issue_card(client, profile, [masaj.id], [{"session_number": 3, "discount_percent": 10}])

    resp = client.post(
        "/payments/multi",
        json={
            "client_id": profile.id,
            "lines": [{"therapy_id": masaj.id}, {"therapy_id": kineto.id}],
            "amount_paid": 150,
        },
    )
    assert resp.status_code == 200, resp.text
    payments = {p["therapy"]["name"]: p for p in client.get(f"/clients/{profile.id}").json()["payments"]}
    assert payments["Masaj"]["status"] == "PLATIT"
    assert payments["Kinetoterapie"]["status"] == "PARTIAL"
    assert float(payments["Kinetoterapie"]["amount_paid"]) == 50
    assert _stamps(client, profile) == 1


def test_booking_with_unpaid_online_payment_is_repriced_not_duplicated(
    client, db_session, make_admin_user, make_client_user, make_therapy
):
    admin, user, profile, masaj, _ = _setup(make_admin_user, make_client_user, make_therapy, client)
    _issue_card(client, profile, [masaj.id], [{"session_number": 1, "discount_percent": 20}])
    appointment = Appointment(
        client_id=profile.id,
        therapy_id=masaj.id,
        starts_at=datetime.now(timezone.utc) + timedelta(days=2),
        created_by_id=user.id,
    )
    db_session.add(appointment)
    db_session.flush()
    online = Payment(
        client_id=profile.id,
        therapy_id=masaj.id,
        appointment_id=appointment.id,
        base_price=100,
        discount_amount=0,
        final_price=100,
        status=PaymentStatus.NEPLATIT,
    )
    db_session.add(online)
    db_session.commit()

    resp = client.post(
        "/payments/multi",
        json={
            "client_id": profile.id,
            "lines": [{"therapy_id": masaj.id, "appointment_id": appointment.id}],
            "amount_paid": 80,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ids"] == [online.id]
    payments = client.get(f"/clients/{profile.id}").json()["payments"]
    assert len(payments) == 1
    assert float(payments[0]["final_price"]) == 80
    assert payments[0]["status"] == "PLATIT"


def test_rejects_paid_or_cancelled_or_foreign_booking(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin, user, profile, masaj, kineto = _setup(make_admin_user, make_client_user, make_therapy, client)
    cancelled = Appointment(
        client_id=profile.id,
        therapy_id=masaj.id,
        starts_at=datetime.now(timezone.utc) + timedelta(days=2),
        created_by_id=admin.id,
        status=AppointmentStatus.ANULATA,
    )
    db_session.add(cancelled)
    db_session.commit()

    base = {"client_id": profile.id}
    resp = client.post("/payments/multi", json={**base, "lines": [{"therapy_id": masaj.id, "appointment_id": cancelled.id}]})
    assert resp.status_code == 422
    resp = client.post("/payments/multi", json={**base, "lines": [{"therapy_id": kineto.id, "appointment_id": cancelled.id}]})
    assert resp.status_code == 422

    paid = client.post(
        "/payments/multi",
        json={**base, "lines": [{"therapy_id": masaj.id}], "amount_paid": 100},
    )
    assert paid.status_code == 200
    assert client.post("/payments/multi", json={**base, "lines": []}).status_code == 422


def test_coupon_applies_only_to_eligible_lines(client, make_admin_user, make_client_user, make_therapy):
    _, _, profile, masaj, kineto = _setup(make_admin_user, make_client_user, make_therapy, client)
    coupon = client.post(
        "/coupons", json={"code": "MASAJ10", "type": "PROCENT", "value": 10, "therapy_ids": [masaj.id]}
    )
    assert coupon.status_code == 200, coupon.text

    preview = client.post(
        "/payments/multi/preview",
        json={
            "client_id": profile.id,
            "lines": [{"therapy_id": masaj.id}, {"therapy_id": kineto.id}],
            "coupon_code": "masaj10",
        },
    ).json()
    assert [line["coupon_code"] for line in preview["lines"]] == ["MASAJ10", None]
    assert float(preview["final_price"]) == 290


def test_receptie_can_create_multi_payment_client_cannot(client, make_admin_user, make_client_user, make_therapy):
    _, _, profile, masaj, _ = _setup(make_admin_user, make_client_user, make_therapy, client)
    client.post("/auth/logout")
    _login(client, identifier="c@example.com")
    resp = client.post("/payments/multi", json={"client_id": profile.id, "lines": [{"therapy_id": masaj.id}]})
    assert resp.status_code == 403


def test_lines_of_different_card_therapies_share_the_counter(client, make_admin_user, make_client_user, make_therapy):
    """Card masaj + kineto, -50% la a 2-a ședință: un masaj și un kineto în
    aceeași plată — kineto e a 2-a ședință a cardului și primește reducerea."""
    _, _, profile, masaj, kineto = _setup(make_admin_user, make_client_user, make_therapy, client)
    _issue_card(client, profile, [masaj.id, kineto.id], [{"session_number": 2, "discount_percent": 50}])

    preview = client.post(
        "/payments/multi/preview",
        json={"client_id": profile.id, "lines": [{"therapy_id": masaj.id}, {"therapy_id": kineto.id}]},
    ).json()
    assert [float(line["final_price"]) for line in preview["lines"]] == [100, 100]
    assert float(preview["final_price"]) == 200


def test_booking_covered_by_a_package_is_not_paid_or_counted(
    client, db_session, make_admin_user, make_client_user, make_therapy
):
    """O programare dintr-un pachet activ se scade din pachet — nu poate fi
    plătită separat, deci nici nu avansează cardul de fidelitate. Nici
    cumpărarea pachetului nu contează la card."""
    admin, _, profile, masaj, _ = _setup(make_admin_user, make_client_user, make_therapy, client)
    _issue_card(client, profile, [masaj.id], [{"session_number": 2, "discount_percent": 50}])
    package_id = client.post(
        "/packages",
        json={"name": "Pachet", "discount_percent": 10, "items": [{"therapy_id": masaj.id, "sessions_included": 3}]},
    ).json()["id"]
    assert client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "amount_paid": 999}).status_code == 200
    appointment = Appointment(
        client_id=profile.id,
        therapy_id=masaj.id,
        starts_at=datetime.now(timezone.utc) + timedelta(days=2),
        created_by_id=admin.id,
    )
    db_session.add(appointment)
    db_session.commit()

    resp = client.post(
        "/payments/multi",
        json={"client_id": profile.id, "lines": [{"therapy_id": masaj.id, "appointment_id": appointment.id}], "amount_paid": 100},
    )
    assert resp.status_code == 422
    assert "pachet" in resp.json()["detail"]
    assert _stamps(client, profile) == 0
