import os

import pytest


@pytest.fixture(autouse=True)
def _upload_dir(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    yield


def _login(client, identifier="admin@example.com", password="parola123"):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text


def test_upload_succeeds_for_admin(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("scan.pdf", b"%PDF-1.4 fake content", "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["original_filename"] == "scan.pdf"
    assert body["content_type"] == "application/pdf"
    assert body["size_bytes"] == len(b"%PDF-1.4 fake content")
    assert body["uploaded_by_label"] == "admin@example.com"


def test_upload_succeeds_for_receptie(client, make_admin_user, make_client_user):
    make_admin_user(email="rec@example.com", password="parola123", role="RECEPTIE")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="rec@example.com")

    resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("photo.jpg", b"fake image bytes", "image/jpeg")},
    )
    assert resp.status_code == 200, resp.text


def test_upload_rejected_for_client_role(client, make_client_user):
    user, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client, identifier="c@example.com")

    resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("scan.pdf", b"content", "application/pdf")},
    )
    assert resp.status_code == 403


def test_upload_rejected_when_unauthenticated(client, make_client_user):
    _, profile = make_client_user(email="c@example.com", password="parola123")

    resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("scan.pdf", b"content", "application/pdf")},
    )
    assert resp.status_code == 401


def test_upload_rejected_for_blocklisted_extension(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("virus.exe", b"MZ...", "application/octet-stream")},
    )
    assert resp.status_code == 400


def test_list_returns_uploaded_docs(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("a.pdf", b"aaa", "application/pdf")},
    )
    client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("b.pdf", b"bbb", "application/pdf")},
    )

    resp = client.get(f"/clients/{profile.id}/documents")
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) == 2
    names = {d["original_filename"] for d in docs}
    assert names == {"a.pdf", "b.pdf"}


def test_download_returns_exact_bytes_with_attachment_header(client, make_admin_user, make_client_user):
    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    content = b"hello world, this is the file content"
    upload_resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("doc.txt", content, "text/plain")},
    )
    doc_id = upload_resp.json()["id"]

    resp = client.get(f"/clients/{profile.id}/documents/{doc_id}/download")
    assert resp.status_code == 200
    assert resp.content == content
    assert "attachment" in resp.headers["content-disposition"]


def test_delete_removes_db_row_and_file(client, make_admin_user, make_client_user):
    from app.config import settings
    from app.services import file_storage

    make_admin_user(email="admin@example.com", password="parola123", role="ADMIN")
    _, profile = make_client_user(email="c@example.com", password="parola123")
    _login(client)

    upload_resp = client.post(
        f"/clients/{profile.id}/documents",
        files={"file": ("doc.txt", b"delete me", "text/plain")},
    )
    doc_id = upload_resp.json()["id"]

    list_resp = client.get(f"/clients/{profile.id}/documents")
    storage_path = f"{profile.id}/{doc_id}_doc.txt"
    full_path = file_storage.resolve_path(storage_path)
    assert os.path.exists(full_path)

    del_resp = client.delete(f"/clients/{profile.id}/documents/{doc_id}")
    assert del_resp.status_code == 200

    list_after = client.get(f"/clients/{profile.id}/documents").json()
    assert list_after == []
    assert not os.path.exists(full_path)
