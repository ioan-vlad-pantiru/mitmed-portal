"""Trimitere WhatsApp (app/services/notifications.py) — formatul numărului și
forma exactă a cererii către Graph API, fără apeluri reale."""

import requests

from app.config import settings
from app.services import notifications
from app.services.notifications import send_appointment_reminder, send_otp, to_whatsapp_number


class _FakeResponse:
    def __init__(self, ok: bool = True, status_code: int = 200):
        self.ok = ok
        self.status_code = status_code
        self.text = "{}"


def _configure(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "123456")
    monkeypatch.setattr(settings, "whatsapp_access_token", "tok")


def _capture_post(monkeypatch, response=None):
    calls: list[dict] = []

    def fake_post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        return response or _FakeResponse()

    monkeypatch.setattr(requests, "post", fake_post)
    return calls


def test_to_whatsapp_number_formats():
    assert to_whatsapp_number("0722 111 222") == "40722111222"
    assert to_whatsapp_number("+40 722-111-222") == "40722111222"
    assert to_whatsapp_number("0040722111222") == "40722111222"
    assert to_whatsapp_number("40722111222") == "40722111222"


def test_noop_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", None)
    monkeypatch.setattr(settings, "whatsapp_access_token", None)
    calls = _capture_post(monkeypatch)

    assert send_otp("0722111222", "123456") is False
    assert calls == []


def test_send_otp_payload(monkeypatch):
    _configure(monkeypatch)
    calls = _capture_post(monkeypatch)

    assert send_otp("0722111222", "123456") is True

    call = calls[0]
    assert call["url"].endswith("/123456/messages")
    assert call["headers"]["Authorization"] == "Bearer tok"
    body = call["json"]
    assert body["to"] == "40722111222"
    assert body["template"]["name"] == settings.whatsapp_otp_template
    assert body["template"]["language"]["code"] == "ro"
    body_component, button_component = body["template"]["components"]
    assert body_component["parameters"] == [{"type": "text", "text": "123456"}]
    assert button_component["sub_type"] == "url"
    assert button_component["parameters"] == [{"type": "text", "text": "123456"}]


def test_send_reminder_param_order(monkeypatch):
    _configure(monkeypatch)
    calls = _capture_post(monkeypatch)

    send_appointment_reminder(
        "0722111222", client_name="Ion", therapy_name="Masaj", starts_at_local="25.09.2026 10:00", when_label="mâine"
    )

    template = calls[0]["json"]["template"]
    assert template["name"] == settings.whatsapp_reminder_template
    values = [p["text"] for p in template["components"][0]["parameters"]]
    assert values == [
        "Ion",
        "mâine",
        "Masaj",
        "25.09.2026 10:00",
        settings.clinic_address,
        settings.clinic_directions_url,
    ]


def test_send_returns_false_on_api_error(monkeypatch):
    _configure(monkeypatch)
    _capture_post(monkeypatch, _FakeResponse(ok=False, status_code=400))

    assert send_otp("0722111222", "123456") is False


def test_send_returns_false_on_network_error(monkeypatch):
    _configure(monkeypatch)

    def boom(*_a, **_k):
        raise requests.ConnectionError()

    monkeypatch.setattr(requests, "post", boom)
    assert notifications.send_otp("0722111222", "123456") is False
