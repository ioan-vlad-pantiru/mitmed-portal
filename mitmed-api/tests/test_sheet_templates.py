"""Tipurile de fișe (consultație, tratament, fișe construite de admin), editarea
doar de către admin și descărcarea în PDF."""

from app.models import TEMPLATE_TRATAMENT


def _login(client, email):
    resp = client.post("/auth/login", json={"identifier": email, "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _field(client, label, **extra):
    resp = client.post("/consultation-sheets/fields", json={"label": label, **extra})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_custom_template_keeps_its_own_fields(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    _login(client, "admin@example.com")

    template = client.post("/consultation-sheets/templates", json={"name": "Fișă evaluare postură"}).json()
    posture = _field(client, "Aliniere bazin", field_type="text", template_id=template["id"])
    consult = _field(client, "Diagnostic")

    fields = client.get("/consultation-sheets/fields", params={"template_id": template["id"]}).json()
    assert [f["id"] for f in fields] == [posture]

    # Un câmp al fișei de consultație nu poate fi completat pe fișa custom.
    resp = client.post(
        "/consultation-sheets",
        json={"client_id": profile.id, "template_id": template["id"], "values": {consult: "x"}},
    )
    assert resp.status_code == 422
    resp = client.post(
        "/consultation-sheets",
        json={"client_id": profile.id, "template_id": template["id"], "values": {posture: "Anteversie"}},
    )
    assert resp.status_code == 200, resp.text
    sheet = client.get(f"/clients/{profile.id}").json()["consultation_sheets"][0]
    assert sheet["template_id"] == template["id"]


def test_system_templates_cannot_be_deleted(client, make_admin_user):
    make_admin_user(email="admin@example.com")
    _login(client, "admin@example.com")
    assert client.delete("/consultation-sheets/templates/consultatie").status_code == 422
    assert client.delete(f"/consultation-sheets/templates/{TEMPLATE_TRATAMENT}").status_code == 422


def test_only_admin_edits_or_deletes_saved_sheet(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com")
    make_admin_user(email="receptie@example.com", role="RECEPTIE")
    _, profile = make_client_user()
    _login(client, "admin@example.com")
    diagnosis = _field(client, "Diagnostic")
    client.post("/auth/logout")

    _login(client, "receptie@example.com")
    sheet_id = client.post("/consultation-sheets", json={"client_id": profile.id, "values": {diagnosis: "A"}}).json()["id"]
    assert client.put(f"/consultation-sheets/{sheet_id}", json={"values": {diagnosis: "B"}}).status_code == 403
    assert client.delete(f"/consultation-sheets/{sheet_id}").status_code == 403
    client.post("/auth/logout")

    _login(client, "admin@example.com")
    assert client.put(f"/consultation-sheets/{sheet_id}", json={"values": {diagnosis: "B"}}).status_code == 200
    assert client.delete(f"/consultation-sheets/{sheet_id}").status_code == 200
    assert client.get(f"/clients/{profile.id}").json()["consultation_sheets"] == []


def test_sheet_pdf_for_staff_and_patient(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com")
    _, profile = make_client_user(email="pacient@example.com", full_name="Ștefan Țîrcă")
    _, other = make_client_user(email="altul@example.com")
    _login(client, "admin@example.com")
    diagnosis = _field(client, "Diagnostic")
    sheet_id = client.post(
        "/consultation-sheets", json={"client_id": profile.id, "values": {diagnosis: "Lombalgie cronică — ședințe"}}
    ).json()["id"]
    hidden = client.post("/consultation-sheets/templates", json={"name": "Internă", "visible_to_client": False}).json()
    hidden_sheet = client.post("/consultation-sheets", json={"client_id": profile.id, "template_id": hidden["id"]}).json()["id"]

    resp = client.get(f"/consultation-sheets/{sheet_id}/pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
    assert "stefan-tirca" in resp.headers["content-disposition"]
    client.post("/auth/logout")

    _login(client, "pacient@example.com")
    assert client.get(f"/consultation-sheets/me/{sheet_id}/pdf").status_code == 200
    assert client.get(f"/consultation-sheets/me/{hidden_sheet}/pdf").status_code == 404
    assert client.get(f"/consultation-sheets/{sheet_id}/pdf").status_code == 403
    listed = client.get("/clients/me").json()["consultation_sheets"]
    assert [s["id"] for s in listed] == [sheet_id]
    assert listed[0]["template_name"] == "Fișă de consultație"
    client.post("/auth/logout")

    _login(client, "altul@example.com")
    assert client.get(f"/consultation-sheets/me/{sheet_id}/pdf").status_code == 404


def test_treatment_fields_on_session_records_and_pdf(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    _login(client, "admin@example.com")
    symptoms = _field(client, "Semne și simptome", template_id=TEMPLATE_TRATAMENT)

    resp = client.post(
        "/medical-records",
        json={"client_id": profile.id, "notes": "Masaj terapeutic", "field_values": {symptoms: "Amețeală ușoară"}},
    )
    assert resp.status_code == 200, resp.text
    record_id = resp.json()["id"]
    record = client.get(f"/clients/{profile.id}").json()["medical_records"][0]
    assert record["field_values"] == {symptoms: "Amețeală ușoară"}

    resp = client.put(f"/medical-records/{record_id}", json={"notes": "Masaj + stretching", "field_values": {symptoms: ""}})
    assert resp.status_code == 200, resp.text
    record = client.get(f"/clients/{profile.id}").json()["medical_records"][0]
    assert record["notes"] == "Masaj + stretching"
    assert record["field_values"] == {}

    resp = client.get(f"/consultation-sheets/treatment/{profile.id}/pdf")
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF")
