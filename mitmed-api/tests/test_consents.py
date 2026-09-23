TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="


def test_sign_then_withdraw_consent(client, make_client_user):
    user, _ = make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"identifier": "c@example.com", "password": "parola123"})
    client.get("/consents/templates/active")  # seedul implicit de template-uri (GDPR, RISC_PRET)

    sign_resp = client.post("/consents/me", json={"type": "GDPR", "signature_data_url": TINY_PNG})
    assert sign_resp.status_code == 200

    listed = client.get("/consents/me").json()
    assert len(listed) == 1
    assert listed[0]["withdrawn_at"] is None
    # Clientul poate revedea oricând exact ce a semnat (text + semnătură),
    # fără ca asta să însemne că poate retrage din același ecran.
    assert listed[0]["signature_data_url"] == TINY_PNG
    assert listed[0]["version_text"]
    consent_id = listed[0]["id"]

    withdraw_resp = client.post(f"/consents/me/{consent_id}/withdraw")
    assert withdraw_resp.status_code == 200

    listed_after = client.get("/consents/me").json()
    assert listed_after[0]["withdrawn_at"] is not None


def test_withdrawing_twice_fails(client, make_client_user):
    make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"identifier": "c@example.com", "password": "parola123"})
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

    client.post("/auth/login", json={"identifier": "c1@example.com", "password": "parola123"})
    client.get("/consents/templates/active")
    client.post("/consents/me", json={"type": "GDPR", "signature_data_url": TINY_PNG})
    consent_id = client.get("/consents/me").json()[0]["id"]
    client.post("/auth/logout")

    client.post("/auth/login", json={"identifier": "c2@example.com", "password": "parola123"})
    resp = client.post(f"/consents/me/{consent_id}/withdraw")

    assert resp.status_code == 404


def test_cannot_withdraw_treatment_risk_declaration(client, make_client_user):
    """RISC_PRET (categorie TRATAMENT) nu e un consimțământ GDPR — clientul
    nu poate să-l "retragă" unilateral, doar consimțământul de prelucrare a
    datelor (categorie PRELUCRARE_DATE) rămâne retractabil oricând."""
    make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"identifier": "c@example.com", "password": "parola123"})
    client.get("/consents/templates/active")
    client.post("/consents/me", json={"type": "RISC_PRET", "signature_data_url": TINY_PNG})
    consent_id = client.get("/consents/me").json()[0]["id"]

    resp = client.post(f"/consents/me/{consent_id}/withdraw")
    assert resp.status_code == 403

    listed = client.get("/consents/me").json()
    assert listed[0]["withdrawn_at"] is None


def test_admin_created_document_defaults_to_non_withdrawable(client, make_admin_user, make_client_user):
    """Un tip nou de document creat de admin pornește pe categoria implicită
    (TRATAMENT) — nu devine retractabil doar pentru că a fost creat recent."""
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    create_resp = client.post("/consents/templates", json={"label": "Acord vaccinare", "text": "Text acord."})
    assert create_resp.status_code == 200, create_resp.text
    doc_type = create_resp.json()["type"]
    client.post("/auth/logout")

    make_client_user(email="c@example.com", password="parola123")
    client.post("/auth/login", json={"identifier": "c@example.com", "password": "parola123"})
    client.post("/consents/me", json={"type": doc_type, "signature_data_url": TINY_PNG})
    consent_id = client.get("/consents/me").json()[0]["id"]

    resp = client.post(f"/consents/me/{consent_id}/withdraw")
    assert resp.status_code == 403
