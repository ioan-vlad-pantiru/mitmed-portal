"""Program editabil (WeekdayHours) și vacanțe (ClinicVacation) — vezi
routers/clinic.py. Programul implicit (luni-vineri 10:00-18:00, pauză
13:00-14:00) e seedat de fixture-ul autouse _seed_default_clinic_hours."""


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


DEFAULT_DAYS = [
    {
        "weekday": d,
        "is_open": d < 5,
        "opens_at": "10:00:00" if d < 5 else None,
        "closes_at": "18:00:00" if d < 5 else None,
        "break_starts_at": "13:00:00" if d < 5 else None,
        "break_ends_at": "14:00:00" if d < 5 else None,
    }
    for d in range(7)
]


def test_get_hours_returns_seeded_defaults(client, make_client_user):
    make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")

    resp = client.get("/clinic/hours")
    assert resp.status_code == 200, resp.text
    days = {d["weekday"]: d for d in resp.json()}
    assert days[0]["is_open"] is True
    assert days[0]["opens_at"] == "10:00:00"
    assert days[5]["is_open"] is False


def test_admin_can_update_hours(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)

    days = [dict(d) for d in DEFAULT_DAYS]
    days[5] = {
        "weekday": 5,
        "is_open": True,
        "opens_at": "09:00:00",
        "closes_at": "13:00:00",
        "break_starts_at": None,
        "break_ends_at": None,
    }
    resp = client.put("/clinic/hours", json={"days": days})
    assert resp.status_code == 200, resp.text

    updated = {d["weekday"]: d for d in client.get("/clinic/hours").json()}
    assert updated[5]["is_open"] is True
    assert updated[5]["opens_at"] == "09:00:00"
    assert updated[5]["break_starts_at"] is None


def test_receptie_cannot_update_hours(client, make_admin_user):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _login(client, identifier="rec@example.com")

    resp = client.put("/clinic/hours", json={"days": DEFAULT_DAYS})
    assert resp.status_code == 403


def test_update_hours_rejects_incomplete_week(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)

    resp = client.put("/clinic/hours", json={"days": DEFAULT_DAYS[:6]})
    assert resp.status_code == 422


def test_update_hours_rejects_open_day_without_times(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)

    days = [dict(d) for d in DEFAULT_DAYS]
    days[0] = {"weekday": 0, "is_open": True, "opens_at": None, "closes_at": None, "break_starts_at": None, "break_ends_at": None}
    resp = client.put("/clinic/hours", json={"days": days})
    assert resp.status_code == 422


def test_admin_can_create_and_delete_vacation(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)

    resp = client.post("/clinic/vacations", json={"starts_on": "2026-12-24", "ends_on": "2026-12-31", "label": "Sărbători"})
    assert resp.status_code == 201, resp.text
    vacation_id = resp.json()["id"]

    listing = client.get("/clinic/vacations").json()
    assert any(v["id"] == vacation_id for v in listing)

    resp = client.delete(f"/clinic/vacations/{vacation_id}")
    assert resp.status_code == 200, resp.text
    assert not any(v["id"] == vacation_id for v in client.get("/clinic/vacations").json())


def test_vacation_end_before_start_is_rejected(client, make_admin_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _login(client)

    resp = client.post("/clinic/vacations", json={"starts_on": "2026-12-31", "ends_on": "2026-12-24"})
    assert resp.status_code == 422


def test_receptie_cannot_create_vacation(client, make_admin_user):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _login(client, identifier="rec@example.com")

    resp = client.post("/clinic/vacations", json={"starts_on": "2026-12-24", "ends_on": "2026-12-31"})
    assert resp.status_code == 403
