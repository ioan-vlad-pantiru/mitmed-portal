"""Carduri de fidelitate: tipuri editabile de admin, cu una sau mai multe
terapii, fiecare cu propriul program de trepte și propriul contor (ex. Masaj:
a 5-a ședință plătită -25%, a 6-a -50%) — routers/fidelity.py.
Reducerea se aplică automat la crearea unei plăți (routers/payments.py),
iar poziția în ciclu avansează la fiecare plată individuală devenită PLATIT
(services/fidelity.py)."""


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _make_type(client, therapy_id, tiers):
    resp = client.post(
        "/fidelity-cards/types", json={"name": "Card", "therapies": [{"therapy_id": therapy_id, "tiers": tiers}]}
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
            "therapies": [
                {
                    "therapy_id": therapy.id,
                    "tiers": [{"session_number": 5, "discount_percent": 25}, {"session_number": 6, "discount_percent": 50}],
                }
            ],
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    type_id = body["id"]
    assert body["therapies"][0]["therapy_name"] == "Masaj"
    assert {t["session_number"] for t in body["therapies"][0]["tiers"]} == {5, 6}

    update_resp = client.put(
        f"/fidelity-cards/types/{type_id}",
        json={
            "name": "Card Masaj Premium",
            "therapies": [
                {
                    "therapy_id": therapy.id,
                    "tiers": [{"session_number": 5, "discount_percent": 30}, {"session_number": 3, "discount_percent": 10}],
                }
            ],
        },
    )
    assert update_resp.status_code == 200, update_resp.text
    tiers = update_resp.json()["therapies"][0]["tiers"]
    # Treapta 5 rămâne (cu alt procent) — editarea nu trebuie să se lovească
    # de indexul unic pe (card, terapie, ședință).
    assert [(t["session_number"], float(t["discount_percent"])) for t in tiers] == [(3, 10.0), (5, 30.0)]

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

    resp = client.post(
        "/fidelity-cards/types", json={"name": "Card", "therapies": [{"therapy_id": therapy.id, "tiers": []}]}
    )
    assert resp.status_code == 422
    resp = client.post("/fidelity-cards/types", json={"name": "Card", "therapies": []})
    assert resp.status_code == 422


def test_card_type_rejects_duplicate_session_numbers(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)

    resp = client.post(
        "/fidelity-cards/types",
        json={
            "name": "Card",
            "therapies": [
                {
                    "therapy_id": therapy.id,
                    "tiers": [{"session_number": 5, "discount_percent": 25}, {"session_number": 5, "discount_percent": 50}],
                }
            ],
        },
    )
    assert resp.status_code == 422


def test_receptie_cannot_create_or_edit_card_type(client, make_admin_user, make_therapy):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    therapy = make_therapy()
    _login(client, identifier="rec@example.com")

    resp = client.post(
        "/fidelity-cards/types",
        json={"name": "Card", "therapies": [{"therapy_id": therapy.id, "tiers": [{"session_number": 5, "discount_percent": 25}]}]},
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


def test_admin_can_issue_and_revoke_client_card(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy()
    _login(client)
    type_id = _make_type(client, therapy.id, [{"session_number": 5, "discount_percent": 25}])

    issue_resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})
    assert issue_resp.status_code == 201, issue_resp.text
    card_id = issue_resp.json()["id"]
    progress = issue_resp.json()["therapies"][0]
    assert progress["stamps"] == 0
    assert progress["cycle_length"] == 5
    assert progress["next_reward"] == {"session_number": 5, "discount_percent": "25.00", "sessions_left": 4}

    revoke_resp = client.post(f"/clients/{profile.id}/fidelity-cards/{card_id}/toggle?active=false")
    assert revoke_resp.status_code == 200
    assert client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]["active"] is False


def test_receptie_can_only_view_client_cards(client, make_admin_user, make_client_user, make_therapy):
    """Atribuirea unui card e decizia adminului — recepția vede progresul,
    dar nu poate emite, revoca, șterge sau schimba terapiile unui card."""
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy()
    _login(client)
    type_id = _make_type(client, therapy.id, [{"session_number": 5, "discount_percent": 25}])
    card_id = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id}).json()["id"]
    client.post("/auth/logout")

    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _login(client, identifier="rec@example.com")
    assert len(client.get(f"/clients/{profile.id}/fidelity-cards").json()) == 1
    assert client.get("/fidelity-cards/issued").status_code == 200
    assert client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id}).status_code == 403
    assert client.post(f"/clients/{profile.id}/fidelity-cards/{card_id}/toggle?active=false").status_code == 403
    assert client.delete(f"/clients/{profile.id}/fidelity-cards/{card_id}").status_code == 403
    assert (
        client.put(f"/clients/{profile.id}/fidelity-cards/{card_id}/therapies", json={"therapy_ids": [therapy.id]}).status_code
        == 403
    )


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
    assert card["therapies"][0]["stamps"] == 0


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
    assert card["therapies"][0]["stamps"] == 1


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
    assert card["therapies"][0]["stamps"] == 0


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


def _setup_paid_card(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy(price=100)
    _login(client)
    _make_type(client, therapy.id, [{"session_number": 3, "discount_percent": 25}])
    type_id = client.get("/fidelity-cards/types").json()[0]["id"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})
    return profile, therapy


def _stamps(client, profile):
    return client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]["therapies"][0]["stamps"]


def test_deleting_a_paid_payment_rolls_back_the_stamp(client, make_admin_user, make_client_user, make_therapy):
    profile, therapy = _setup_paid_card(client, make_admin_user, make_client_user, make_therapy)
    ids = []
    for _ in range(2):
        pid = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]
        client.post(f"/payments/{pid}/mark-paid")
        ids.append(pid)
    assert _stamps(client, profile) == 2

    assert client.delete(f"/payments/{ids[1]}").status_code == 200
    assert _stamps(client, profile) == 1
    assert client.delete(f"/payments/{ids[0]}").status_code == 200
    assert _stamps(client, profile) == 0


def test_deleting_an_unpaid_payment_leaves_stamps_alone(client, make_admin_user, make_client_user, make_therapy):
    profile, therapy = _setup_paid_card(client, make_admin_user, make_client_user, make_therapy)
    paid = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]
    client.post(f"/payments/{paid}/mark-paid")
    unpaid = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]
    assert _stamps(client, profile) == 1

    assert client.delete(f"/payments/{unpaid}").status_code == 200
    assert _stamps(client, profile) == 1


def test_rollback_wraps_back_across_the_cycle(client, make_admin_user, make_client_user, make_therapy):
    profile, therapy = _setup_paid_card(client, make_admin_user, make_client_user, make_therapy)
    ids = []
    for _ in range(3):
        pid = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]
        client.post(f"/payments/{pid}/mark-paid")
        ids.append(pid)
    assert _stamps(client, profile) == 0  # ciclu de 3 încheiat

    client.delete(f"/payments/{ids[2]}")
    assert _stamps(client, profile) == 2


def test_correcting_paid_payment_down_and_up_stamps_once(client, make_admin_user, make_client_user, make_therapy):
    profile, therapy = _setup_paid_card(client, make_admin_user, make_client_user, make_therapy)
    pid = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id}).json()["id"]
    client.post(f"/payments/{pid}/mark-paid")
    assert _stamps(client, profile) == 1

    client.post(f"/payments/{pid}/correct-amount-paid", json={"amount_paid": 40})
    assert _stamps(client, profile) == 0
    client.post(f"/payments/{pid}/correct-amount-paid", json={"amount_paid": 100})
    assert _stamps(client, profile) == 1


def _make_multi_type(client, therapies):
    resp = client.post("/fidelity-cards/types", json={"name": "Card Recuperare", "therapies": therapies})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _pay(client, profile, therapy):
    resp = client.post("/payments", json={"client_id": profile.id, "therapy_id": therapy.id, "amount_paid": 999999})
    assert resp.status_code == 200, resp.text
    detail = client.get(f"/clients/{profile.id}").json()
    return float(next(p for p in detail["payments"] if p["id"] == resp.json()["id"])["final_price"])


def test_card_with_several_therapies_counts_each_separately(client, make_admin_user, make_client_user, make_therapy):
    """Masaj -25% la a 3-a ședință de masaj, Kinetoterapie -50% la a 2-a
    ședință de kineto — ședințele unei terapii nu avansează contorul
    celeilalte."""
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    masaj = make_therapy(name="Masaj", price=100)
    kineto = make_therapy(name="Kinetoterapie", price=200)
    _login(client)
    type_id = _make_multi_type(
        client,
        [
            {"therapy_id": masaj.id, "tiers": [{"session_number": 3, "discount_percent": 25}]},
            {"therapy_id": kineto.id, "tiers": [{"session_number": 2, "discount_percent": 50}]},
        ],
    )
    listed = client.get("/fidelity-cards/types").json()[0]
    assert [t["therapy_name"] for t in listed["therapies"]] == ["Kinetoterapie", "Masaj"]
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    assert _pay(client, profile, masaj) == 100
    assert _pay(client, profile, masaj) == 100
    assert _pay(client, profile, kineto) == 200
    assert _pay(client, profile, masaj) == 75  # a 3-a de masaj
    assert _pay(client, profile, kineto) == 100  # a 2-a de kineto
    assert _pay(client, profile, kineto) == 200  # ciclul de kineto reluat

    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    by_name = {t["therapy_name"]: t for t in card["therapies"]}
    assert by_name["Masaj"]["stamps"] == 0
    assert by_name["Masaj"]["discounted_sessions_used"] == 1
    assert by_name["Kinetoterapie"]["stamps"] == 1
    assert by_name["Kinetoterapie"]["next_discount_percent"] == "50.00"
    assert by_name["Kinetoterapie"]["next_reward"]["sessions_left"] == 0


def test_therapy_outside_the_card_is_not_counted(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    masaj = make_therapy(name="Masaj", price=100)
    other = make_therapy(name="Altceva", price=100)
    _login(client)
    type_id = _make_type(client, masaj.id, [{"session_number": 1, "discount_percent": 25}])
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})

    assert _pay(client, profile, other) == 100
    card = client.get(f"/clients/{profile.id}/fidelity-cards").json()[0]
    assert [t["therapy_name"] for t in card["therapies"]] == ["Masaj"]
    assert card["therapies"][0]["stamps"] == 0


def test_card_type_rejects_duplicate_therapy(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    therapy = make_therapy()
    _login(client)
    tier = [{"session_number": 5, "discount_percent": 25}]
    resp = client.post(
        "/fidelity-cards/types",
        json={"name": "Card", "therapies": [{"therapy_id": therapy.id, "tiers": tier}, {"therapy_id": therapy.id, "tiers": tier}]},
    )
    assert resp.status_code == 422


def test_admin_sees_progress_of_all_issued_cards(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123", full_name="Ana Pop")
    therapy = make_therapy(price=100)
    _login(client)
    type_id = _make_type(client, therapy.id, [{"session_number": 4, "discount_percent": 20}])
    client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id})
    _pay(client, profile, therapy)

    issued = client.get("/fidelity-cards/issued").json()
    assert len(issued) == 1
    assert issued[0]["client_name"] == "Ana Pop"
    assert issued[0]["therapies"][0]["stamps"] == 1
    assert issued[0]["therapies"][0]["next_reward"]["sessions_left"] == 2


def test_admin_picks_which_card_therapies_apply_to_the_client(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    masaj = make_therapy(name="Masaj", price=100)
    kineto = make_therapy(name="Kinetoterapie", price=100)
    _login(client)
    type_id = _make_multi_type(
        client,
        [
            {"therapy_id": masaj.id, "tiers": [{"session_number": 2, "discount_percent": 25}]},
            {"therapy_id": kineto.id, "tiers": [{"session_number": 1, "discount_percent": 50}]},
        ],
    )
    resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id, "therapy_ids": [masaj.id]})
    assert resp.status_code == 201, resp.text
    card_id = resp.json()["id"]
    assert [t["therapy_name"] for t in resp.json()["therapies"]] == ["Masaj"]

    # Kineto nu e pe cardul acestui client — fără reducere, fără contor.
    assert _pay(client, profile, kineto) == 100
    assert _pay(client, profile, masaj) == 100

    # Adminul activează kineto ulterior; scoaterea masajului îi păstrează contorul.
    resp = client.put(f"/clients/{profile.id}/fidelity-cards/{card_id}/therapies", json={"therapy_ids": [kineto.id]})
    assert resp.status_code == 200, resp.text
    assert [t["therapy_name"] for t in resp.json()["therapies"]] == ["Kinetoterapie"]
    assert _pay(client, profile, kineto) == 50
    assert _pay(client, profile, masaj) == 100  # masaj pe pauză — nici reducere, nici ștampilă

    resp = client.put(
        f"/clients/{profile.id}/fidelity-cards/{card_id}/therapies", json={"therapy_ids": [kineto.id, masaj.id]}
    )
    masaj_progress = next(t for t in resp.json()["therapies"] if t["therapy_name"] == "Masaj")
    assert masaj_progress["stamps"] == 1
    assert _pay(client, profile, masaj) == 75


def test_cannot_pick_a_therapy_outside_the_card_type(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    masaj = make_therapy(name="Masaj")
    other = make_therapy(name="Altceva")
    _login(client)
    type_id = _make_type(client, masaj.id, [{"session_number": 2, "discount_percent": 25}])

    resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id, "therapy_ids": [other.id]})
    assert resp.status_code == 422
    resp = client.post(f"/clients/{profile.id}/fidelity-cards", json={"card_type_id": type_id, "therapy_ids": []})
    assert resp.status_code == 422
