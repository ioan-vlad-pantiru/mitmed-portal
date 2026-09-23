VALID_CNP = "1900101123457"


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def test_staff_can_set_and_clear_cnp(client, make_admin_user, make_client_user):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="rec@example.com")

    resp = client.patch(f"/clients/{profile.id}/cnp", json={"cnp": VALID_CNP})
    assert resp.status_code == 200, resp.text
    assert client.get(f"/clients/{profile.id}").json()["cnp"] == VALID_CNP

    resp = client.patch(f"/clients/{profile.id}/cnp", json={"cnp": ""})
    assert resp.status_code == 200, resp.text
    assert client.get(f"/clients/{profile.id}").json()["cnp"] is None


def test_invalid_cnp_rejected(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    for bad in ["123", "1900101123458", "abcdefghijklm", "0900101123457"]:
        resp = client.patch(f"/clients/{profile.id}/cnp", json={"cnp": bad})
        assert resp.status_code == 422, bad


def test_client_cannot_set_cnp(client, make_client_user):
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")

    resp = client.patch(f"/clients/{profile.id}/cnp", json={"cnp": VALID_CNP})
    assert resp.status_code == 403
