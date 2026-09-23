from datetime import date


def _payload(**overrides):
    base = {
        "full_name": "Ion Popescu",
        "email": "ion@example.com",
        "phone": "0722111222",
        "password": "parola123",
        "birth_date": date(2000, 1, 1).isoformat(),
        "accepted_privacy_policy": True,
    }
    base.update(overrides)
    return base


def test_register_requires_minimum_age(client):
    minor_birth_date = date.today().replace(year=date.today().year - 10).isoformat()

    resp = client.post("/auth/register", json=_payload(birth_date=minor_birth_date))

    assert resp.status_code == 422


def test_register_requires_privacy_policy_acceptance(client):
    resp = client.post("/auth/register", json=_payload(accepted_privacy_policy=False))

    assert resp.status_code == 422


def test_register_creates_pending_account(client):
    resp = client.post("/auth/register", json=_payload())

    assert resp.status_code == 201

    # Contul e PENDING — login-ul trebuie refuzat până la aprobare.
    login_resp = client.post("/auth/login", json={"identifier": "ion@example.com", "password": "parola123"})
    assert login_resp.status_code == 403


def test_register_with_phone_only_succeeds(client):
    resp = client.post("/auth/register", json=_payload(email=None, phone="0722333444"))

    assert resp.status_code == 201


def test_login_lookup_by_phone_works(client):
    resp = client.post("/auth/register", json=_payload(email=None, phone="0722555666"))
    assert resp.status_code == 201

    # Contul e PENDING — dar autentificarea trebuie să găsească userul după
    # telefon (403, nu 401), ceea ce dovedește că lookup-ul după telefon merge.
    login_resp = client.post("/auth/login", json={"identifier": "0722555666", "password": "parola123"})
    assert login_resp.status_code == 403


def test_register_rejects_duplicate_phone(client):
    resp1 = client.post("/auth/register", json=_payload(email="a@example.com", phone="0722777888"))
    assert resp1.status_code == 201

    resp2 = client.post("/auth/register", json=_payload(email="b@example.com", phone="0722777888"))
    assert resp2.status_code == 409
