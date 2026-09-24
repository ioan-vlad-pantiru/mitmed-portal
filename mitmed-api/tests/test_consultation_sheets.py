VALID_CNP = "1900101123457"


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def test_staff_can_create_and_edit_consultation_sheet(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.post(
        "/consultation-sheets",
        json={
            "client_id": profile.id,
            "marital_status": "Căsătorit",
            "antecedents": "  HTA  ",
            "blood_pressure": "130/80",
            "pulse": "72",
            "oxygen_saturation": "98%",
            "glycemia": "95",
            "symptoms": "Durere lombară",
            "diagnosis": "Lombalgie",
            "recommendations": "Kinetoterapie",
        },
    )
    assert resp.status_code == 200, resp.text
    sheet_id = resp.json()["id"]

    sheets = client.get(f"/clients/{profile.id}").json()["consultation_sheets"]
    assert len(sheets) == 1
    assert sheets[0]["antecedents"] == "HTA"
    assert sheets[0]["oxygen_saturation"] == "98%"
    assert sheets[0]["working_conditions"] is None

    resp = client.put(f"/consultation-sheets/{sheet_id}", json={"pulse": "80", "diagnosis": "Lombalgie cronică"})
    assert resp.status_code == 200, resp.text
    sheet = client.get(f"/clients/{profile.id}").json()["consultation_sheets"][0]
    assert sheet["pulse"] == "80"
    assert sheet["diagnosis"] == "Lombalgie cronică"
    assert sheet["blood_pressure"] is None


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
