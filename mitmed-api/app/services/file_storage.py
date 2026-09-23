"""Stocare pe disc pentru documentele atașate fișei clientului.

Fișierele sunt scrise sub settings.upload_dir/{client_id}/{doc_id}_{nume_sigur}.
Nu se face nicio interpretare a conținutului — descărcarea (vezi router-ul
client_documents) forțează întotdeauna `Content-Disposition: attachment`,
ceea ce e adevărata protecție împotriva XSS pentru conținut arbitrar încărcat,
nu blocklist-ul de extensii de mai jos (care e doar o plasă suplimentară).
"""

import os

from app.config import settings

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

BLOCKED_EXTENSIONS = {
    ".exe", ".sh", ".bat", ".cmd", ".msi", ".com", ".scr", ".php", ".js", ".jar", ".app", ".dll",
}


class FileStorageError(ValueError):
    """Eroare de validare a fișierului încărcat — traduce-o în HTTP 400 la nivel de router."""


def _extension(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return ext.lower()


def validate_upload(original_filename: str, content: bytes) -> None:
    if _extension(original_filename) in BLOCKED_EXTENSIONS:
        raise FileStorageError("Acest tip de fișier nu este permis.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise FileStorageError("Fișierul depășește dimensiunea maximă permisă (25 MB).")


def _safe_filename(original_filename: str) -> str:
    name = os.path.basename(original_filename).replace("..", "")
    name = name.strip() or "fisier"
    return name


def save_file(client_id: str, doc_id: str, original_filename: str, content: bytes) -> str:
    safe_name = _safe_filename(original_filename)
    client_dir = os.path.join(settings.upload_dir, client_id)
    os.makedirs(client_dir, exist_ok=True)

    relative_path = f"{client_id}/{doc_id}_{safe_name}"
    full_path = os.path.join(settings.upload_dir, relative_path)
    with open(full_path, "wb") as f:
        f.write(content)

    return relative_path


def resolve_path(storage_path: str) -> str:
    return os.path.join(settings.upload_dir, storage_path)


def delete_file(storage_path: str) -> None:
    full_path = resolve_path(storage_path)
    if os.path.exists(full_path):
        os.remove(full_path)
