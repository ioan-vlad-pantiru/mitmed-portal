VALID_CNP = "1900101123457"


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def _make_field(client, label, **extra):
    resp = client.post("/consultation-sheets/fields", json={"label": label, **extra})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_staff_can_create_and_edit_consultation_sheet(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)
    antecedents = _make_field(client, "Antecedente", carry_over=True)
    pulse = _make_field(client, "Puls", field_type="text", section="Evaluări")
    diagnosis = _make_field(client, "Diagnostic")

    resp = client.post(
        "/consultation-sheets",
        json={
            "client_id": profile.id,
            "sheet_number": " 12 ",
            "values": {antecedents: "  HTA  ", pulse: "72", diagnosis: "Lombalgie"},
        },
    )
    assert resp.status_code == 200, resp.text
    sheet_id = resp.json()["id"]

    sheets = client.get(f"/clients/{profile.id}").json()["consultation_sheets"]
    assert len(sheets) == 1
    assert sheets[0]["sheet_number"] == "12"
    assert sheets[0]["values"] == {antecedents: "HTA", pulse: "72", diagnosis: "Lombalgie"}

    resp = client.put(f"/consultation-sheets/{sheet_id}", json={"values": {pulse: "80", diagnosis: ""}})
    assert resp.status_code == 200, resp.text
    values = client.get(f"/clients/{profile.id}").json()["consultation_sheets"][0]["values"]
    assert values == {antecedents: "HTA", pulse: "80"}


def test_unknown_field_is_rejected(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)
    resp = client.post("/consultation-sheets", json={"client_id": profile.id, "values": {"nope": "x"}})
    assert resp.status_code == 422


def test_admin_manages_sheet_fields(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)
    a = _make_field(client, "A")
    b = _make_field(client, "B", field_type="text", placeholder="mg/dl")
    c = _make_field(client, "C")

    resp = client.put(f"/consultation-sheets/fields/{b}", json={"label": "B2", "field_type": "textarea", "carry_over": True})
    assert resp.status_code == 200, resp.text
    assert resp.json()["label"] == "B2"
    assert resp.json()["placeholder"] is None

    assert client.post(f"/consultation-sheets/fields/{c}/move", json={"direction": "up"}).status_code == 200
    assert [f["id"] for f in client.get("/consultation-sheets/fields").json()] == [a, c, b]

    client.post("/consultation-sheets", json={"client_id": profile.id, "values": {a: "valoare veche"}})
    assert client.delete(f"/consultation-sheets/fields/{a}").status_code == 200
    assert [f["id"] for f in client.get("/consultation-sheets/fields").json()] == [c, b]
    archived = client.get("/consultation-sheets/fields", params={"include_archived": True}).json()
    assert any(f["id"] == a and f["archived"] for f in archived)
    # Valoarea de pe fișa veche rămâne, chiar dacă câmpul a fost șters.
    sheet = client.get(f"/clients/{profile.id}").json()["consultation_sheets"][0]
    assert sheet["values"] == {a: "valoare veche"}
    client.put(f"/consultation-sheets/{sheet['id']}", json={"values": {c: "nou"}})
    sheet = client.get(f"/clients/{profile.id}").json()["consultation_sheets"][0]
    assert sheet["values"] == {a: "valoare veche", c: "nou"}


def test_receptie_cannot_manage_sheet_fields(client, make_admin_user):
    make_admin_user(email="r@example.com", password="parola123", role="RECEPTIE")
    _login(client, identifier="r@example.com")
    assert client.get("/consultation-sheets/fields").status_code == 200
    assert client.post("/consultation-sheets/fields", json={"label": "X"}).status_code == 403


def test_client_cannot_create_consultation_sheet(client, make_client_user):
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")
    resp = client.post("/consultation-sheets", json={"client_id": profile.id})
    assert resp.status_code == 403


def test_staff_can_update_patient_details_and_keep_survey_data(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.patch(
        f"/clients/{profile.id}/details",
        json={
            "full_name": "Ion Popescu",
            "phone": "0722111222",
            "cnp": VALID_CNP,
            "birth_date": "1990-01-01",
            "gender": "MASCULIN",
            "city": "Fălticeni",
            "county": "Suceava",
            "address": "Str. Test 1",
            "occupation": "Șofer",
        },
    )
    assert resp.status_code == 200, resp.text
    detail = client.get(f"/clients/{profile.id}").json()
    assert detail["full_name"] == "Ion Popescu"
    assert detail["cnp"] == VALID_CNP
    assert detail["profile_data"]["occupation"] == "Șofer"
    assert detail["profile_data"]["address"] == "Str. Test 1"

    resp = client.patch(f"/clients/{profile.id}/details", json={"full_name": "Ion Popescu", "cnp": "123"})
    assert resp.status_code == 422


def test_client_cannot_use_staff_details_endpoint(client, make_client_user):
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")
    resp = client.patch(f"/clients/{profile.id}/details", json={"full_name": "X"})
    assert resp.status_code == 403
