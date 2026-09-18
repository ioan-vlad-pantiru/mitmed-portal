from app.security import MAX_FAILED_LOGIN_ATTEMPTS


def test_wrong_password_returns_generic_401(client, make_client_user):
    make_client_user(email="client@example.com", password="parola-buna")

    resp = client.post("/auth/login", json={"email": "client@example.com", "password": "gresita"})

    assert resp.status_code == 401
    assert "incorect" in resp.json()["detail"].lower()


def test_unknown_email_returns_same_generic_error(client):
    resp = client.post("/auth/login", json={"email": "nu-exista@example.com", "password": "orice"})

    assert resp.status_code == 401
    assert "incorect" in resp.json()["detail"].lower()


def test_account_locks_after_repeated_failures(client, make_client_user):
    make_client_user(email="client@example.com", password="parola-buna")

    for _ in range(MAX_FAILED_LOGIN_ATTEMPTS):
        resp = client.post("/auth/login", json={"email": "client@example.com", "password": "gresita"})
        assert resp.status_code == 401

    # Chiar cu parola corectă, contul e blocat temporar acum.
    locked_resp = client.post("/auth/login", json={"email": "client@example.com", "password": "parola-buna"})
    assert locked_resp.status_code == 429


def test_successful_login_resets_failed_attempts(client, make_client_user):
    make_client_user(email="client@example.com", password="parola-buna")

    client.post("/auth/login", json={"email": "client@example.com", "password": "gresita"})
    client.post("/auth/login", json={"email": "client@example.com", "password": "gresita"})

    ok_resp = client.post("/auth/login", json={"email": "client@example.com", "password": "parola-buna"})
    assert ok_resp.status_code == 200
