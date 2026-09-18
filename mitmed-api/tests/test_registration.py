from datetime import date


def _payload(**overrides):
    base = {
        "full_name": "Ion Popescu",
        "email": "ion@example.com",
        "phone": None,
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
    login_resp = client.post("/auth/login", json={"email": "ion@example.com", "password": "parola123"})
    assert login_resp.status_code == 403
