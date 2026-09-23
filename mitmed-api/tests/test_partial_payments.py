"""Plăți parțiale — amount_paid pe Payment, status derivat (NEPLATIT/PARTIAL/
PLATIT), și fiecare loc unde o plată se creează sau se completează:
POST /payments, POST /payments/{id}/mark-paid, checkout PayU, webhook PayU,
/insights."""


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _get_payment(client, client_profile_id, payment_id):
    detail = client.get(f"/clients/{client_profile_id}").json()
    return next(p for p in detail["payments"] if p["id"] == payment_id)


def test_create_payment_with_partial_amount(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)

    resp = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 80})
    assert resp.status_code == 200, resp.text
    payment = _get_payment(client, profile.id, resp.json()["id"])
    assert payment["status"] == "PARTIAL"
    assert float(payment["amount_paid"]) == 80.0
    assert float(payment["final_price"]) == 200.0


def test_create_payment_with_no_amount_is_unpaid(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)

    resp = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id})
    payment = _get_payment(client, profile.id, resp.json()["id"])
    assert payment["status"] == "NEPLATIT"
    assert float(payment["amount_paid"]) == 0.0


def test_create_payment_amount_clamped_to_final_price(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)

    resp = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 9999})
    payment = _get_payment(client, profile.id, resp.json()["id"])
    assert payment["status"] == "PLATIT"
    assert float(payment["amount_paid"]) == 200.0


def test_package_partial_payment_splits_proportionally(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=300)
    _login(client)

    package_resp = client.post(
        "/packages",
        json={
            "name": "Pachet mixt",
            "discount_percent": 0,
            "items": [
                {"therapy_id": therapy_a.id, "sessions_included": 1},
                {"therapy_id": therapy_b.id, "sessions_included": 1},
            ],
        },
    )
    assert package_resp.status_code == 200, package_resp.text
    package_id = package_resp.json()["id"]
    # Preț total pachet = 400 (fără reducere), ponderi 100/300 -> 25%/75%.

    resp = client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "amount_paid": 40})
    assert resp.status_code == 200, resp.text

    detail = client.get(f"/clients/{profile.id}").json()
    payments = {p["id"]: p for p in detail["payments"] if p["id"] in resp.json()["ids"]}
    total_paid = sum(float(p["amount_paid"]) for p in payments.values())
    total_price = sum(float(p["final_price"]) for p in payments.values())
    assert total_paid == 40.0
    assert total_price == 400.0
    assert all(p["status"] == "PARTIAL" for p in payments.values())


def test_mark_paid_records_partial_amount_and_accumulates(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=300)
    _login(client)
    payment_id = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]

    first = client.post(f"/payments/{payment_id}/mark-paid", json={"amount": 100})
    assert first.status_code == 200, first.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "PARTIAL"
    assert float(payment["amount_paid"]) == 100.0

    second = client.post(f"/payments/{payment_id}/mark-paid", json={"amount": 150})
    assert second.status_code == 200, second.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "PARTIAL"
    assert float(payment["amount_paid"]) == 250.0

    # Fără sumă explicită -> încasează tot restul.
    third = client.post(f"/payments/{payment_id}/mark-paid")
    assert third.status_code == 200, third.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "PLATIT"
    assert float(payment["amount_paid"]) == 300.0


def test_mark_paid_clamps_amount_over_remaining(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    payment_id = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]

    resp = client.post(f"/payments/{payment_id}/mark-paid", json={"amount": 99999})
    assert resp.status_code == 200, resp.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "PLATIT"
    assert float(payment["amount_paid"]) == 100.0


def test_mark_paid_rejects_already_fully_paid(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 100}
    ).json()["id"]

    resp = client.post(f"/payments/{payment_id}/mark-paid")
    assert resp.status_code == 422


def test_mark_paid_rejects_zero_or_negative_amount(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    payment_id = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]

    resp = client.post(f"/payments/{payment_id}/mark-paid", json={"amount": 0})
    assert resp.status_code == 422


def test_fidelity_stamp_only_registers_when_payment_reaches_full(
    client, make_admin_user, make_client_user, make_therapy
):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    # Prag la a 2-a ședință, nu la prima — altfel un ciclu de lungime 1 ar
    # face ca `stamps` să rămână mereu 0 (0 % 1 == 0), ambiguu pentru test.
    type_resp = client.post(
        "/fidelity-cards/types",
        json={"name": "Card", "therapy_id": therapy.id, "tiers": [{"session_number": 2, "discount_percent": 10}]},
    )
    type_id = type_resp.json()["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 50}
    ).json()["id"]
    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert card["stamps"] == 0  # plată parțială — nu contează încă

    client.post(f"/payments/{payment_id}/mark-paid")  # completează restul -> PLATIT
    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert card["stamps"] == 1


def test_payu_checkout_charges_only_remaining_balance(client, make_admin_user, make_client_user, make_therapy, monkeypatch):
    captured = {}

    def fake_create_order(*, ext_order_id, total_amount_bani, description, customer_ip, buyer_email, notify_url, continue_url):
        captured["total_amount_bani"] = total_amount_bani
        return {"redirect_url": "https://payu.example/pay", "order_id": "ORDER123"}

    monkeypatch.setattr("app.routers.payments.payu.create_order", fake_create_order)

    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 60}
    ).json()["id"]

    resp = client.post(f"/payments/{payment_id}/payu-checkout")
    assert resp.status_code == 200, resp.text
    # Rest de plată: 200 - 60 = 140 RON = 14000 bani, nu 200 RON integral.
    assert captured["total_amount_bani"] == 14000


def test_outstanding_insight_reports_remaining_not_full_price(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 60})

    resp = client.get("/insights/outstanding")
    assert resp.status_code == 200, resp.text
    row = next(r for r in resp.json() if r["client_id"] == profile.id)
    assert row["status"] == "PARTIAL"
    assert float(row["amount_paid"]) == 60.0
    assert float(row["remaining"]) == 140.0


def test_overall_insight_revenue_includes_partial_amounts(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 60})

    resp = client.get("/insights/overall")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["revenue_this_month"]) >= 60.0
    assert float(body["outstanding"]) >= 140.0


def _create_mixed_package(client, profile_id, therapy_a, therapy_b, amount_paid=None):
    package_id = client.post(
        "/packages",
        json={
            "name": "Pachet mixt",
            "discount_percent": 0,
            "items": [
                {"therapy_id": therapy_a.id, "sessions_included": 1},
                {"therapy_id": therapy_b.id, "sessions_included": 1},
            ],
        },
    ).json()["id"]
    payload = {"client_id": profile_id, "package_id": package_id}
    if amount_paid is not None:
        payload["amount_paid"] = amount_paid
    resp = client.post("/payments", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["ids"]


def _package_purchase_id(client, profile_id, payment_ids):
    detail = client.get(f"/clients/{profile_id}").json()
    row = next(p for p in detail["payments"] if p["id"] == payment_ids[0])
    return row["package_purchase_id"]


def test_mark_package_paid_distributes_across_lines(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=300)
    _login(client)
    ids = _create_mixed_package(client, profile.id, therapy_a, therapy_b)
    purchase_id = _package_purchase_id(client, profile.id, ids)

    # Total = 400 RON, plătim 200 -> jumătate din fiecare linie (100->50, 300->150).
    resp = client.post(f"/payments/package/{purchase_id}/mark-paid", json={"amount": 200})
    assert resp.status_code == 200, resp.text

    detail = client.get(f"/clients/{profile.id}").json()
    lines = {p["id"]: p for p in detail["payments"] if p["id"] in ids}
    total_paid = sum(float(p["amount_paid"]) for p in lines.values())
    assert total_paid == 200.0
    assert all(p["status"] == "PARTIAL" for p in lines.values())


def test_mark_package_paid_without_amount_pays_off_everything(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=300)
    _login(client)
    ids = _create_mixed_package(client, profile.id, therapy_a, therapy_b, amount_paid=40)
    purchase_id = _package_purchase_id(client, profile.id, ids)

    resp = client.post(f"/payments/package/{purchase_id}/mark-paid")
    assert resp.status_code == 200, resp.text

    detail = client.get(f"/clients/{profile.id}").json()
    lines = {p["id"]: p for p in detail["payments"] if p["id"] in ids}
    assert all(p["status"] == "PLATIT" for p in lines.values())
    assert sum(float(p["amount_paid"]) for p in lines.values()) == 400.0


def test_mark_package_paid_rejects_already_settled(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=100)
    _login(client)
    ids = _create_mixed_package(client, profile.id, therapy_a, therapy_b, amount_paid=999999)
    purchase_id = _package_purchase_id(client, profile.id, ids)

    resp = client.post(f"/payments/package/{purchase_id}/mark-paid")
    assert resp.status_code == 422


def test_mark_package_paid_unknown_purchase_is_404(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)
    resp = client.post("/payments/package/does-not-exist/mark-paid")
    assert resp.status_code == 404


def test_correct_amount_paid_can_undo_to_zero(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 200}
    ).json()["id"]

    resp = client.post(f"/payments/{payment_id}/correct-amount-paid", json={"amount_paid": 0})
    assert resp.status_code == 200, resp.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "NEPLATIT"
    assert float(payment["amount_paid"]) == 0.0


def test_correct_amount_paid_can_fix_to_a_different_partial_value(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 200}
    ).json()["id"]

    resp = client.post(f"/payments/{payment_id}/correct-amount-paid", json={"amount_paid": 50})
    assert resp.status_code == 200, resp.text
    payment = _get_payment(client, profile.id, payment_id)
    assert payment["status"] == "PARTIAL"
    assert float(payment["amount_paid"]) == 50.0


def test_correct_amount_paid_is_visible_and_gated_by_payu_flag(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    payment_id = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]

    payment = _get_payment(client, profile.id, payment_id)
    assert payment["paid_via_payu"] is False


def test_correct_amount_paid_rejects_payu_confirmed_payment(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    payment_id = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]

    # Simulează o confirmare reală prin PayU (webhook), fără endpoint public
    # de test pentru semnătură — setăm direct ce ar seta webhook-ul.
    from app.database import SessionLocal
    from app.models import Payment, PaymentStatus

    db = SessionLocal()
    try:
        payment = db.get(Payment, payment_id)
        payment.amount_paid = payment.final_price
        payment.status = PaymentStatus.PLATIT
        payment.method = "CARD_ONLINE"
        payment.payu_order_id = "ORDER-XYZ"
        db.commit()
    finally:
        db.close()

    payment = _get_payment(client, profile.id, payment_id)
    assert payment["paid_via_payu"] is True

    resp = client.post(f"/payments/{payment_id}/correct-amount-paid", json={"amount_paid": 0})
    assert resp.status_code == 422


def test_correct_package_amount_paid_redistributes_proportionally(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=300)
    _login(client)
    ids = _create_mixed_package(client, profile.id, therapy_a, therapy_b, amount_paid=400)
    purchase_id = _package_purchase_id(client, profile.id, ids)

    resp = client.post(f"/payments/package/{purchase_id}/correct-amount-paid", json={"amount_paid": 0})
    assert resp.status_code == 200, resp.text

    detail = client.get(f"/clients/{profile.id}").json()
    lines = {p["id"]: p for p in detail["payments"] if p["id"] in ids}
    assert all(p["status"] == "NEPLATIT" for p in lines.values())
    assert sum(float(p["amount_paid"]) for p in lines.values()) == 0.0


def test_correct_package_amount_paid_unknown_purchase_is_404(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)
    resp = client.post("/payments/package/does-not-exist/correct-amount-paid", json={"amount_paid": 0})
    assert resp.status_code == 404


def test_receptie_can_correct_amount_paid(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client, identifier="rec@example.com")
    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 200}
    ).json()["id"]

    resp = client.post(f"/payments/{payment_id}/correct-amount-paid", json={"amount_paid": 0})
    assert resp.status_code == 200, resp.text
