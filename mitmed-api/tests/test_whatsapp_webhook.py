import hashlib
import hmac
import json

from app.config import settings


def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_verify_returns_challenge_for_correct_token(client, monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_verify_token", "tok123")
    resp = client.get(
        "/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "tok123", "hub.challenge": "42"}
    )
    assert resp.status_code == 200
    assert resp.text == "42"


def test_verify_rejects_wrong_or_unset_token(client, monkeypatch):
    params = {"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"}
    monkeypatch.setattr(settings, "whatsapp_verify_token", "tok123")
    assert client.get("/webhooks/whatsapp", params=params).status_code == 403
    monkeypatch.setattr(settings, "whatsapp_verify_token", None)
    assert client.get("/webhooks/whatsapp", params=params).status_code == 403


def test_post_requires_valid_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_app_secret", "s3cret")
    body = json.dumps({"object": "whatsapp_business_account", "entry": []}).encode()
    headers = {"Content-Type": "application/json"}

    assert client.post("/webhooks/whatsapp", content=body, headers=headers).status_code == 403
    bad = {**headers, "X-Hub-Signature-256": _sign("other", body)}
    assert client.post("/webhooks/whatsapp", content=body, headers=bad).status_code == 403
    good = {**headers, "X-Hub-Signature-256": _sign("s3cret", body)}
    assert client.post("/webhooks/whatsapp", content=body, headers=good).status_code == 200


def test_post_rejected_when_secret_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_app_secret", None)
    resp = client.post("/webhooks/whatsapp", content=b"{}", headers={"X-Hub-Signature-256": "sha256=x"})
    assert resp.status_code == 403
