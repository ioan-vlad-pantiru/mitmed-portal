def test_export_own_data_contains_expected_sections(client, make_client_user):
    make_client_user(email="c@example.com", password="parola123", full_name="Ana Ionescu")
    client.post("/auth/login", json={"email": "c@example.com", "password": "parola123"})

    resp = client.get("/clients/me/export")

    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Ana Ionescu"
    assert "account" in data and data["account"]["email"] == "c@example.com"
    assert "medical_records" in data
    assert "payments" in data
    assert "appointments" in data
    assert "consents" in data


def test_erasure_request_lifecycle(client, make_client_user, make_admin_user):
    _, profile = make_client_user(email="c@example.com", password="parola123", full_name="Ana Ionescu")
    make_admin_user(email="admin@example.com", password="parola123")

    client.post("/auth/login", json={"email": "c@example.com", "password": "parola123"})
    request_resp = client.post("/clients/me/erasure-request")
    assert request_resp.status_code == 201

    # A doua cerere, cât timp prima e încă în așteptare, e refuzată.
    duplicate_resp = client.post("/clients/me/erasure-request")
    assert duplicate_resp.status_code == 409
    client.post("/auth/logout")

    client.post("/auth/login", json={"email": "admin@example.com", "password": "parola123"})
    pending = client.get("/data-subject-requests").json()
    assert len(pending) == 1
    request_id = pending[0]["id"]

    complete_resp = client.post(f"/data-subject-requests/{request_id}/complete")
    assert complete_resp.status_code == 200

    detail = client.get(f"/clients/{profile.id}").json()
    assert detail["full_name"] == "Client șters (cerere GDPR)"
    assert detail["user"]["status"] == "SUSPENDED"
    # Fișele/plățile rămân — nu se șterg (obligație legală de arhivare).
    assert "medical_records" in detail
