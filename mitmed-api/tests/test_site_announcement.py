"""Bara de anunț de pe mitmed.ro — editată de admin, citită public."""


def _login(client, email):
    resp = client.post("/auth/login", json={"identifier": email, "password": "parola123"})
    assert resp.status_code == 200, resp.text


def test_admin_edits_and_hides_announcement(client, make_admin_user):
    make_admin_user(email="admin@example.com")
    assert client.get("/public/announcement").json()["enabled"] is False

    _login(client, "admin@example.com")
    resp = client.put("/site/announcement", json={"enabled": True, "text": "  Program de sărbători:   închis 1-2 ian. ", "mobile_text": ""})
    assert resp.status_code == 200, resp.text

    public = client.get("/public/announcement").json()
    assert public == {"enabled": True, "text": "Program de sărbători: închis 1-2 ian.", "mobile_text": None}

    client.put("/site/announcement", json={"enabled": False, "text": "Program de sărbători"})
    assert client.get("/public/announcement").json() == {"enabled": False, "text": None, "mobile_text": None}
    # Textul rămâne salvat pentru o reactivare ulterioară.
    assert client.get("/site/announcement").json()["text"] == "Program de sărbători"


def test_enabled_bar_needs_text(client, make_admin_user):
    make_admin_user(email="admin@example.com")
    _login(client, "admin@example.com")
    assert client.put("/site/announcement", json={"enabled": True, "text": "   "}).status_code == 422


def test_only_admin_can_edit(client, make_admin_user):
    make_admin_user(email="receptie@example.com", role="RECEPTIE")
    _login(client, "receptie@example.com")
    assert client.put("/site/announcement", json={"enabled": False, "text": ""}).status_code == 403
