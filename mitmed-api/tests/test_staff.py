"""Conturi de personal create din /admin/personal."""


def _login(client, email, password="parola123"):
    return client.post("/auth/login", json={"identifier": email, "password": password})


def test_admin_creates_reception_account_that_can_log_in(client, make_admin_user):
    make_admin_user(email="admin@example.com")
    assert _login(client, "admin@example.com").status_code == 200

    resp = client.post("/staff", json={"email": " Ana@Example.com ", "password": "parolaNoua1", "role": "RECEPTIE"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == "ana@example.com"
    assert resp.json()["role"] == "RECEPTIE"

    staff = client.get("/staff").json()
    assert [s["email"] for s in staff] == ["admin@example.com", "ana@example.com"]

    client.post("/auth/logout")
    resp = _login(client, "ana@example.com", "parolaNoua1")
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "RECEPTIE"


def test_duplicate_email_and_client_role_rejected(client, make_admin_user):
    make_admin_user(email="admin@example.com")
    _login(client, "admin@example.com")
    assert client.post("/staff", json={"email": "admin@example.com", "password": "parolaNoua1"}).status_code == 409
    assert client.post("/staff", json={"email": "x@example.com", "password": "parolaNoua1", "role": "CLIENT"}).status_code == 422
    assert client.post("/staff", json={"email": "x@example.com", "password": "scurt"}).status_code == 422


def test_only_admin_manages_staff(client, make_admin_user):
    make_admin_user(email="receptie@example.com", role="RECEPTIE")
    _login(client, "receptie@example.com")
    assert client.get("/staff").status_code == 403
    assert client.post("/staff", json={"email": "x@example.com", "password": "parolaNoua1"}).status_code == 403


def test_suspend_logs_out_and_blocks_login(client, make_admin_user):
    admin = make_admin_user(email="admin@example.com")
    reception = make_admin_user(email="receptie@example.com", role="RECEPTIE")

    # Recepția are o sesiune deschisă înainte de suspendare.
    _login(client, "receptie@example.com")
    reception_cookies = dict(client.cookies)
    client.cookies.clear()

    _login(client, "admin@example.com")
    assert client.post(f"/staff/{admin.id}/status", json={"active": False}).status_code == 400
    resp = client.post(f"/staff/{reception.id}/status", json={"active": False})
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUSPENDED"

    client.cookies.clear()
    client.cookies.update(reception_cookies)
    assert client.get("/auth/me").status_code == 401
    assert _login(client, "receptie@example.com").status_code == 403

    client.cookies.clear()
    _login(client, "admin@example.com")
    client.post(f"/staff/{reception.id}/status", json={"active": True})
    client.cookies.clear()
    assert _login(client, "receptie@example.com").status_code == 200
