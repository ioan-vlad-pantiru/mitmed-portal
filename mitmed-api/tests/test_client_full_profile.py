VALID_CNP = "1900101123457"


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _payload(**overrides):
    payload = {
        "full_name": "Maria Pop",
        "email": "Maria@Example.com",
        "phone": "0722000111",
        "cnp": VALID_CNP,
        "birth_date": "1990-01-01",
        "emergency_contact_name": "Ion Pop",
        "emergency_contact_phone": "0722000222",
        "medical_history": {"allergies": "polen", "conditions": "  "},
        "profile_data": {"gender": "FEMININ", "city": "Bacău", "primary_goal": "DURERE", "communication_consent": True},
    }
    payload.update(overrides)
    return payload


def test_staff_can_edit_full_profile(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.put(f"/clients/{profile.id}/profile", json=_payload())
    assert resp.status_code == 200, resp.text

    data = client.get(f"/clients/{profile.id}").json()
    assert data["full_name"] == "Maria Pop"
    assert data["user"]["email"] == "maria@example.com"
    assert data["phone"] == "0722000111"
    assert data["cnp"] == VALID_CNP
    assert data["emergency_contact_name"] == "Ion Pop"
    assert data["medical_history"] == {"allergies": "polen"}
    assert data["profile_data"] == {
        "gender": "FEMININ",
        "city": "Bacău",
        "primary_goal": "DURERE",
        "communication_consent": True,
    }


def test_empty_profile_stays_null(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.put(
        f"/clients/{profile.id}/profile",
        json=_payload(medical_history={}, profile_data={"communication_consent": False}),
    )
    assert resp.status_code == 200, resp.text
    data = client.get(f"/clients/{profile.id}").json()
    assert data["profile_data"] is None
    assert data["medical_history"] is None


def test_duplicate_email_rejected(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    make_client_user(email="other@example.com", password="parola123")
    _login(client)

    resp = client.put(f"/clients/{profile.id}/profile", json=_payload(email="other@example.com"))
    assert resp.status_code == 409


def test_invalid_cnp_rejected(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.put(f"/clients/{profile.id}/profile", json=_payload(cnp="1900101123458"))
    assert resp.status_code == 422


def test_client_cannot_edit_full_profile(client, make_client_user):
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")

    resp = client.put(f"/clients/{profile.id}/profile", json=_payload())
    assert resp.status_code == 403
