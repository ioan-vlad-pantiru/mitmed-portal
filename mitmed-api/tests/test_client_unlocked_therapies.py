def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def test_staff_can_unlock_and_relock_therapies(client, make_admin_user, make_client_user, make_therapy):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy()
    _login(client, identifier="rec@example.com")

    resp = client.put(f"/clients/{profile.id}/unlocked-therapies", json={"therapy_ids": [therapy.id]})
    assert resp.status_code == 200, resp.text
    detail = client.get(f"/clients/{profile.id}").json()
    assert detail["unlocked_therapy_ids"] == [therapy.id]

    resp = client.put(f"/clients/{profile.id}/unlocked-therapies", json={"therapy_ids": []})
    assert resp.status_code == 200, resp.text
    assert client.get(f"/clients/{profile.id}").json()["unlocked_therapy_ids"] == []


def test_client_cannot_unlock_therapies_for_self(client, make_client_user, make_therapy):
    _, profile = make_client_user(email="c@example.com", password="parola123")
    therapy = make_therapy()
    _login(client, identifier="c@example.com")

    resp = client.put(f"/clients/{profile.id}/unlocked-therapies", json={"therapy_ids": [therapy.id]})
    assert resp.status_code == 403


def test_client_therapy_list_shows_only_consultation_and_unlocked(
    client, make_admin_user, make_client_user, make_therapy
):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    consultation = make_therapy(name="Consultație", is_consultation=True)
    locked = make_therapy(name="Kinetoterapie")
    unlocked = make_therapy(name="Masaj")

    _login(client, identifier="admin@example.com")
    resp = client.put(f"/clients/{profile.id}/unlocked-therapies", json={"therapy_ids": [unlocked.id]})
    assert resp.status_code == 200, resp.text
    client.post("/auth/logout")

    _login(client, identifier="c@example.com")
    names = {t["name"] for t in client.get("/therapies").json()}
    assert names == {consultation.name, unlocked.name}
    assert locked.name not in names
