"""Cupon de reducere aplicat la cumpărarea unui pachet — reducerea se ia din
prețul întregului pachet și se împarte pe linii cu aceleași ponderi ca prețul."""


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _setup(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy_a = make_therapy(name="A", price=100)
    therapy_b = make_therapy(name="B", price=300)
    _login(client)
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
    return profile, therapy_a, therapy_b, package_id


def _purchase_lines(client, profile_id, ids):
    detail = client.get(f"/clients/{profile_id}").json()
    return [p for p in detail["payments"] if p["id"] in ids]


def test_percent_coupon_discounts_whole_package(client, make_admin_user, make_client_user, make_therapy):
    profile, _, _, package_id = _setup(client, make_admin_user, make_client_user, make_therapy)
    client.post("/coupons", json={"code": "PACHET10", "type": "PROCENT", "value": 10, "therapy_ids": []})

    preview = client.get("/payments/package-preview", params={"package_id": package_id, "coupon_code": "pachet10"})
    assert {k: float(v) for k, v in preview.json().items()} == {
        "base_price": 400.0,
        "discount_amount": 40.0,
        "final_price": 360.0,
    }

    resp = client.post(
        "/payments",
        json={"client_id": profile.id, "package_id": package_id, "coupon_code": "PACHET10", "amount_paid": 360},
    )
    assert resp.status_code == 200, resp.text
    lines = _purchase_lines(client, profile.id, resp.json()["ids"])
    assert sum(float(p["final_price"]) for p in lines) == 360.0
    assert sum(float(p["discount_amount"]) for p in lines) == 40.0
    assert all(p["status"] == "PLATIT" for p in lines)
    for p in lines:
        assert round(float(p["base_price"]) - float(p["discount_amount"]), 2) == float(p["final_price"])

    coupon = client.get("/coupons").json()[0]
    assert coupon["uses_count"] == 1


def test_fixed_coupon_is_subtracted_once(client, make_admin_user, make_client_user, make_therapy):
    profile, _, _, package_id = _setup(client, make_admin_user, make_client_user, make_therapy)
    client.post("/coupons", json={"code": "MINUS50", "type": "FIX", "value": 50, "therapy_ids": []})

    resp = client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "coupon_code": "MINUS50"})
    assert resp.status_code == 200, resp.text
    lines = _purchase_lines(client, profile.id, resp.json()["ids"])
    assert sum(float(p["final_price"]) for p in lines) == 350.0


def test_coupon_limited_to_some_package_therapies_is_refused(client, make_admin_user, make_client_user, make_therapy):
    profile, therapy_a, _, package_id = _setup(client, make_admin_user, make_client_user, make_therapy)
    client.post("/coupons", json={"code": "DOARA", "type": "PROCENT", "value": 10, "therapy_ids": [therapy_a.id]})

    resp = client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "coupon_code": "DOARA"})
    assert resp.status_code == 422
    assert "pachet" in resp.json()["detail"]


def test_unknown_coupon_on_package_is_refused(client, make_admin_user, make_client_user, make_therapy):
    profile, _, _, package_id = _setup(client, make_admin_user, make_client_user, make_therapy)
    resp = client.post("/payments", json={"client_id": profile.id, "package_id": package_id, "coupon_code": "NU-EXISTA"})
    assert resp.status_code == 422
