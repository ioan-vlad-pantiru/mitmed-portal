def _request(**overrides):
    base = {"full_name": "Maria Ionescu", "phone": "0722111222"}
    base.update(overrides)
    return base


def test_public_therapies_lists_only_active_without_price(client, db_session, make_therapy):
    consult = make_therapy(name="Consultație", is_consultation=True)
    make_therapy(name="Dry Needling")
    inactive = make_therapy(name="Retrasă")
    inactive.active = False
    db_session.commit()

    res = client.get("/public/therapies")

    assert res.status_code == 200
    body = res.json()
    assert [t["name"] for t in body] == ["Consultație", "Dry Needling"]
    assert body[0]["id"] == consult.id
    assert "price" not in body[0]


def test_guest_booking_request_is_stored(client, make_therapy):
    therapy = make_therapy()

    res = client.post(
        "/public/booking-requests",
        json=_request(therapy_id=therapy.id, preferred_starts_at="2026-10-05T10:00:00+03:00"),
    )

    assert res.status_code == 201
    assert res.json()["ok"] is True


def test_rate_limit_is_per_forwarded_visitor_ip(client):
    # Toate cererile vin prin proxy-ul portalului (aceeași adresă directă),
    # dar limita trebuie să se aplice per vizitator, după X-Forwarded-For.
    for _ in range(10):
        res = client.post("/public/booking-requests", json=_request(), headers={"X-Forwarded-For": "203.0.113.7"})
        assert res.status_code == 201

    blocked = client.post("/public/booking-requests", json=_request(), headers={"X-Forwarded-For": "203.0.113.7"})
    assert blocked.status_code == 429

    other = client.post("/public/booking-requests", json=_request(), headers={"X-Forwarded-For": "198.51.100.4"})
    assert other.status_code == 201
