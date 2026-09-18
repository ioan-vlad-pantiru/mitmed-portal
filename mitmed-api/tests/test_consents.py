TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="


def test_sign_then_withdraw_consent(client, make_client_user):
    user, _ = make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"email": "c@example.com", "password": "parola123"})
    client.get("/consents/templates/active")  # seedul implicit de template-uri (GDPR, RISC_PRET)

    sign_resp = client.post("/consents/me", json={"type": "GDPR", "signature_data_url": TINY_PNG})
    assert sign_resp.status_code == 200

    listed = client.get("/consents/me").json()
    assert len(listed) == 1
    assert listed[0]["withdrawn_at"] is None
    consent_id = listed[0]["id"]

    withdraw_resp = client.post(f"/consents/me/{consent_id}/withdraw")
    assert withdraw_resp.status_code == 200

    listed_after = client.get("/consents/me").json()
    assert listed_after[0]["withdrawn_at"] is not None


def test_withdrawing_twice_fails(client, make_client_user):
    make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"email": "c@example.com", "password": "parola123"})
    client.get("/consents/templates/active")
    client.post("/consents/me", json={"type": "GDPR", "signature_data_url": TINY_PNG})
    consent_id = client.get("/consents/me").json()[0]["id"]

    first = client.post(f"/consents/me/{consent_id}/withdraw")
    second = client.post(f"/consents/me/{consent_id}/withdraw")

    assert first.status_code == 200
    assert second.status_code == 422


def test_cannot_withdraw_someone_elses_consent(client, make_client_user):
    make_client_user(email="c1@example.com", password="parola123")
    make_client_user(email="c2@example.com", password="parola123")

    client.post("/auth/login", json={"email": "c1@example.com", "password": "parola123"})
    client.get("/consents/templates/active")
    client.post("/consents/me", json={"type": "GDPR", "signature_data_url": TINY_PNG})
    consent_id = client.get("/consents/me").json()[0]["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={"email": "c2@example.com", "password": "parola123"})
    resp = client.post(f"/consents/me/{consent_id}/withdraw")

    assert resp.status_code == 404
