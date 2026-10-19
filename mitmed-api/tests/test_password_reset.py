"""Resetarea parolei pe email — /auth/forgot-password trimite un link de
unică folosință, /auth/reset-password îl consumă."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models import PasswordResetToken


@pytest.fixture
def sent(monkeypatch):
    emails: list[dict] = []

    def fake_send(to, *, name, reset_url, valid_minutes):
        emails.append({"to": to, "name": name, "url": reset_url})
        return True

    monkeypatch.setattr("app.routers.auth.send_password_reset", fake_send)
    return emails


def _token(email: dict) -> str:
    return email["url"].rsplit("/", 1)[1]


def test_reset_flow_changes_password_and_logs_out(client, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    assert client.post("/auth/login", json={"identifier": "ana@example.com", "password": "parola-veche"}).status_code == 200

    resp = client.post("/auth/forgot-password", json={"email": "ANA@example.com"})
    assert resp.status_code == 200
    assert len(sent) == 1 and sent[0]["to"] == "ana@example.com"
    assert "/resetare-parola/" in sent[0]["url"]
    token = _token(sent[0])

    assert client.get(f"/auth/reset-password/{token}").status_code == 200
    resp = client.post("/auth/reset-password", json={"token": token, "new_password": "parola-noua"})
    assert resp.status_code == 200, resp.text

    # Sesiunea de dinainte nu mai e valabilă.
    assert client.get("/auth/me").status_code == 401
    assert client.post("/auth/login", json={"identifier": "ana@example.com", "password": "parola-veche"}).status_code == 401
    assert client.post("/auth/login", json={"identifier": "ana@example.com", "password": "parola-noua"}).status_code == 200


def test_token_is_single_use(client, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    token = _token(sent[0])
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "parola-noua"}).status_code == 200
    again = client.post("/auth/reset-password", json={"token": token, "new_password": "alta-parola"})
    assert again.status_code == 422
    assert client.get(f"/auth/reset-password/{token}").status_code == 422


def test_new_request_invalidates_previous_link(client, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    first, second = _token(sent[0]), _token(sent[1])
    assert client.post("/auth/reset-password", json={"token": first, "new_password": "parola-noua"}).status_code == 422
    assert client.post("/auth/reset-password", json={"token": second, "new_password": "parola-noua"}).status_code == 200


def test_expired_token_is_refused(client, db_session, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    reset = db_session.query(PasswordResetToken).one()
    reset.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()
    resp = client.post("/auth/reset-password", json={"token": _token(sent[0]), "new_password": "parola-noua"})
    assert resp.status_code == 422


def test_unknown_email_gets_same_answer_and_no_email(client, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    known = client.post("/auth/forgot-password", json={"email": "ana@example.com"}).json()
    unknown = client.post("/auth/forgot-password", json={"email": "nimeni@example.com"}).json()
    assert known == unknown
    assert len(sent) == 1


def test_short_new_password_is_refused(client, make_client_user, sent):
    make_client_user(email="ana@example.com", password="parola-veche")
    client.post("/auth/forgot-password", json={"email": "ana@example.com"})
    resp = client.post("/auth/reset-password", json={"token": _token(sent[0]), "new_password": "scurt"})
    assert resp.status_code == 422
