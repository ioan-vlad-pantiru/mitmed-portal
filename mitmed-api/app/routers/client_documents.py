from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import ClientDocument, ClientProfile, Role, User
from app.services import file_storage

router = APIRouter(tags=["client-documents"])


class ClientDocumentSummary(BaseModel):
    id: str
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime
    uploaded_by_label: str


def _label(user: User | None) -> str:
    if not user:
        return "Utilizator șters"
    return user.email or "Utilizator"


def _get_document_or_404(db: DBSession, client_id: str, doc_id: str) -> ClientDocument:
    doc = db.get(ClientDocument, doc_id)
    if not doc or doc.client_id != client_id:
        raise HTTPException(status_code=404, detail="Document inexistent.")
    return doc


@router.post("/clients/{client_id}/documents", response_model=ClientDocumentSummary)
def upload_client_document(
    client_id: str,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> ClientDocumentSummary:
    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")

    content = file.file.read()
    try:
        file_storage.validate_upload(file.filename or "", content)
    except file_storage.FileStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    from app.models import gen_id

    doc_id = gen_id()
    storage_path = file_storage.save_file(client_id, doc_id, file.filename or "fisier", content)

    doc = ClientDocument(
        id=doc_id,
        client_id=client_id,
        uploaded_by_id=actor.id,
        original_filename=file.filename or "fisier",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_path=storage_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_audit(
        db,
        actor_id=actor.id,
        action="client_document.upload",
        target_type="ClientDocument",
        target_id=doc.id,
        metadata={"client_id": client_id, "filename": doc.original_filename},
    )

    return ClientDocumentSummary(
        id=doc.id,
        original_filename=doc.original_filename,
        content_type=doc.content_type,
        size_bytes=doc.size_bytes,
        created_at=doc.created_at,
        uploaded_by_label=_label(actor),
    )


@router.get("/clients/{client_id}/documents", response_model=list[ClientDocumentSummary])
def list_client_documents(
    client_id: str,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[ClientDocumentSummary]:
    docs = (
        db.query(ClientDocument)
        .filter(ClientDocument.client_id == client_id)
        .order_by(ClientDocument.created_at.desc())
        .all()
    )
    uploader_ids = {d.uploaded_by_id for d in docs}
    uploaders = {u.id: u for u in db.query(User).filter(User.id.in_(uploader_ids)).all()} if uploader_ids else {}

    return [
        ClientDocumentSummary(
            id=d.id,
            original_filename=d.original_filename,
            content_type=d.content_type,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
            uploaded_by_label=_label(uploaders.get(d.uploaded_by_id)),
        )
        for d in docs
    ]


@router.get("/clients/{client_id}/documents/{doc_id}/download")
def download_client_document(
    client_id: str,
    doc_id: str,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> FileResponse:
    doc = _get_document_or_404(db, client_id, doc_id)
    full_path = file_storage.resolve_path(doc.storage_path)
    return FileResponse(
        full_path,
        media_type=doc.content_type,
        filename=doc.original_filename,
        content_disposition_type="attachment",
    )


@router.delete("/clients/{client_id}/documents/{doc_id}")
def delete_client_document(
    client_id: str,
    doc_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    doc = _get_document_or_404(db, client_id, doc_id)
    file_storage.delete_file(doc.storage_path)
    db.delete(doc)
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="client_document.delete",
        target_type="ClientDocument",
        target_id=doc_id,
        metadata={"client_id": client_id, "filename": doc.original_filename},
    )
    return {"ok": True}
