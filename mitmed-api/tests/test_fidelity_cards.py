"""Carduri de fidelitate: tipuri editabile de admin, cu un program de trepte
per card (ex. a 5-a ședință plătită -25%, a 6-a -50%) — routers/fidelity.py.
Reducerea se aplică automat la crearea unei plăți (routers/payments.py),
iar poziția în ciclu avansează la fiecare plată individuală devenită PLATIT
(services/fidelity.py)."""


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _make_type(client, therapy_id, tiers):
    resp = client.post(
        "/fidelity-cards/types", json={"name": "Card", "therapy_id": therapy_id, "tiers": tiers}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_admin_can_crud_card_type_with_tiers(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy(name="Masaj")
    _login(client)

    create_resp = client.post(
        "/fidelity-cards/types",
        json={
            "name": "Card Masaj",
            "therapy_id": therapy.id,
            "tiers": [{"session_number": 5, "discount_percent": 25}, {"session_number": 6, "discount_percent": 50}],
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    type_id = body["id"]
    assert body["therapy_name"] == "Masaj"
    assert {t["session_number"] for t in body["tiers"]} == {5, 6}

    update_resp = client.put(
        f"/fidelity-cards/types/{type_id}",
        json={"name": "Card Masaj Premium", "therapy_id": therapy.id, "tiers": [{"session_number": 3, "discount_percent": 10}]},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert len(update_resp.json()["tiers"]) == 1
    assert update_resp.json()["tiers"][0]["session_number"] == 3

    toggle_resp = client.post(f"/fidelity-cards/types/{type_id}/toggle?active=false")
    assert toggle_resp.status_code == 200
    assert client.get("/fidelity-cards/types").json()[0]["active"] is False

    delete_resp = client.delete(f"/fidelity-cards/types/{type_id}")
    assert delete_resp.status_code == 200, delete_resp.text
    assert client.get("/fidelity-cards/types").json() == []


def test_card_type_requires_at_least_one_tier(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)

    resp = client.post("/fidelity-cards/types", json={"name": "Card", "therapy_id": therapy.id, "tiers": []})
    assert resp.status_code == 422


def test_card_type_rejects_duplicate_session_numbers(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)

    resp = client.post(
        "/fidelity-cards/types",
        json={
            "name": "Card",
            "therapy_id": therapy.id,
            "tiers": [{"session_number": 5, "discount_percent": 25}, {"session_number": 5, "discount_percent": 50}],
        },
    )
    assert resp.status_code == 422


def test_receptie_cannot_create_or_edit_card_type(client, make_admin_user, make_therapy):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    therapy = make_therapy()
    _login(client, identifier="rec@example.com")

    resp = client.post(
        "/fidelity-cards/types", json={"name": "Card", "therapy_id": therapy.id, "tiers": [{"session_number": 5, "discount_percent": 25}]}
    )
    assert resp.status_code == 403


def test_cannot_delete_card_type_already_issued(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy()
    _login(client)
    type_id = _make_type(client, therapy.id, [{"session_number": 5, "discount_percent": 25}])
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    resp = client.delete(f"/fidelity-cards/types/{type_id}")
    assert resp.status_code == 409


def test_receptie_can_issue_and_revoke_client_card(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)
    type_id = _make_type(client, therapy.id, [{"session_number": 5, "discount_percent": 25}])
    client.post("/auth/logout")

    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="rec@example.com")

    issue_resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})
    assert issue_resp.status_code == 201, issue_resp.text
    card_id = issue_resp.json()["id"]
    assert issue_resp.json()["stamps"] == 0
    assert issue_resp.json()["cycle_length"] == 5

    listed = client.get(f"/clients/{profile.id}/fidelity-cards").json()
    assert len(listed) == 1

    revoke_resp = client.post(f"/clients/{profile.id}/fidelity-cards/{card_id}/toggle?active=false")
    assert revoke_resp.status_code == 200
    assert client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]["active"] is False


def test_discount_applies_automatically_at_the_right_session(client, make_admin_user, make_client_user, make_therapy):
    """A 5-a ședință plătită -25%, a 6-a -50% — ședințele 1-4 la preț
    întreg, a 7-a reia ciclul (echivalentă cu a 1-a: preț întreg)."""
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(
        client,
        therapy.id,
        [{"session_number": 5, "discount_percent": 25}, {"session_number": 6, "discount_percent": 50}],
    )
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    final_prices = []
    for _ in range(7):
        resp = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 999999})
        assert resp.status_code == 200, resp.text
        payment_id = resp.json()["id"]
        # Prețul e vizibil în istoricul plăților clientului.
        detail = client.get(f"/clients/{profile.id}").json()
        payment = next(p for p in detail["payments"] if p["id"] == payment_id)
        final_prices.append(float(payment["final_price"]))

    assert final_prices == [100, 100, 100, 100, 75, 50, 100]


def test_preview_shows_fidelity_discount(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=200)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 1, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    resp = client.get("/payments/preview", params={"therapy_id": therapy.id, "client_id": profile.id})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert float(body["final_price"]) == 150.0
    assert float(body["fidelity_discount_percent"]) == 25.0


def test_explicit_coupon_takes_priority_over_fidelity_discount(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 1, "discount_percent": 90}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    coupon_resp = client.post("/coupons", json={"code": "REDUCERE10", "type": "PROCENT", "value": 10, "therapy_ids": []})
    assert coupon_resp.status_code == 200, coupon_resp.text

    resp = client.post(
        "/payments",
        json={"client_id": profile.id, "therapy_id": therapy.id, "coupon_code": "REDUCERE10", "amount_paid": 999999},
    )
    assert resp.status_code == 200, resp.text
    detail = client.get(f"/clients/{profile.id}").json()
    payment = next(p for p in detail["payments"] if p["id"] == resp.json()["id"])
    assert float(payment["final_price"]) == 90.0  # cuponul (10%), nu treapta de fidelitate (90%)


def test_unpaid_payment_does_not_advance_cycle(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 1, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id})

    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert card["stamps"] == 0


def test_mark_paid_later_also_advances_cycle(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 2, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    payment_id = client.post(
        "/payments", json={"client_id": profile.id, "therapy_id": therapy.id}
    ).json()["id"]
    client.post(f"/payments/{payment_id}/mark-paid")

    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert card["stamps"] == 1


def test_package_payment_does_not_advance_cycle(client, make_admin_user, make_client_user, make_therapy):
    """Cumpărarea unui pachet nu trebuie să contribuie și la fidelitate —
    cele două mecanisme de reducere pe volum nu se cumulează."""
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 1, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    package_resp = client.post(
        "/packages",
        json={"name": "Pachet", "discount_percent": 10, "items": [{"therapy_id": therapy.id, "sessions_included": 3}]},
    )
    assert package_resp.status_code == 200, package_resp.text
    package_id = package_resp.json()["id"]

    client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "amount_paid": 999999})

    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert card["stamps"] == 0


def test_own_fidelity_cards_endpoint_only_shows_own_active_cards(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile_a = make_client_user(email="a@example.com", password="parola123")
    make_client_user(email="b@example.com", password="parola123")
    therapy = make_therapy()
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 5, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile_a.id}/fidelity-cards", json={"card_type_id": type_id})
    client.post("/auth/logout")

    _login(client, identifier="a@example.com")
    own = client.get("/clients/me/fidelity-cards").json()
    assert len(own) == 1

    client.post("/auth/logout")
    _login(client, identifier="b@example.com")
    own_b = client.get("/clients/me/fidelity-cards").json()
    assert own_b == []
