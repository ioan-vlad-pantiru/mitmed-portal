"""Staff "Contul meu": see how many devices are signed in, sign the others out,
and a password change signs the other devices out too."""

from app.config import settings


def _login(client, email="admin@example.com"):
    resp = client.post("/auth/login", json={"identifier": email, "password": "parola123"})
    assert resp.status_code == 200, resp.text
    return client.cookies.get(settings.session_cookie_name)


def _use(client, token):
    client.cookies.clear()
    client.cookies.set(settings.session_cookie_name, token)


def test_sign_out_other_devices(client, make_admin_user):
    make_admin_user()
    laptop = _login(client)
    client.cookies.clear()
    phone = _login(client)

    assert client.get("/auth/sessions").json()["active"] == 2
    assert client.post("/auth/sessions/sign-out-others").json() == {"signed_out": 1}

    assert client.get("/auth/me").status_code == 200  # this device stays signed in
    _use(client, laptop)
    assert client.get("/auth/me").status_code == 401


def test_password_change_signs_out_other_devices(client, make_admin_user):
    make_admin_user()
    laptop = _login(client)
    client.cookies.clear()
    _login(client)

    resp = client.post("/auth/change-password", json={"current_password": "parola123", "new_password": "parola-noua-123"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["other_devices_signed_out"] == 1
    assert client.get("/auth/me").status_code == 200
    _use(client, laptop)
    assert client.get("/auth/me").status_code == 401
