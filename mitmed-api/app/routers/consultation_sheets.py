from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import ClientProfile, ConsultationSheet, ConsultationSheetField, Role, User

router = APIRouter(prefix="/consultation-sheets", tags=["consultation-sheets"])

MAX_VALUE_LENGTH = 4000


# --- Câmpurile fișei (configurate de admin) ---


class SheetFieldPayload(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    field_type: Literal["text", "textarea"] = "textarea"
    section: str | None = Field(default=None, max_length=120)
    placeholder: str | None = Field(default=None, max_length=120)
    carry_over: bool = False


class MovePayload(BaseModel):
    direction: Literal["up", "down"]


def serialize_field(f: ConsultationSheetField) -> dict:
    return {
        "id": f.id,
        "label": f.label,
        "field_type": f.field_type,
        "section": f.section,
        "placeholder": f.placeholder,
        "carry_over": f.carry_over,
        "position": f.position,
        "archived": f.archived,
    }


def _apply_field_payload(field: ConsultationSheetField, payload: SheetFieldPayload) -> None:
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=422, detail="Denumirea câmpului e obligatorie.")
    field.label = label
    field.field_type = payload.field_type
    field.section = (payload.section or "").strip() or None
    field.placeholder = (payload.placeholder or "").strip() or None
    field.carry_over = payload.carry_over


def _get_field(db: DBSession, field_id: str) -> ConsultationSheetField:
    field = db.get(ConsultationSheetField, field_id)
    if not field or field.archived:
        raise HTTPException(status_code=404, detail="Câmp inexistent.")
    return field


@router.get("/fields")
def list_fields(
    include_archived: bool = False,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    query = db.query(ConsultationSheetField)
    if not include_archived:
        query = query.filter(ConsultationSheetField.archived.is_(False))
    return [serialize_field(f) for f in query.order_by(ConsultationSheetField.position, ConsultationSheetField.created_at)]


@router.post("/fields")
def create_field(
    payload: SheetFieldPayload,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    last = db.query(func.max(ConsultationSheetField.position)).scalar()
    field = ConsultationSheetField(position=(last if last is not None else -1) + 1)
    _apply_field_payload(field, payload)
    db.add(field)
    db.commit()
    log_audit(db, actor_id=actor.id, action="consultation_sheet_field.create", target_type="ConsultationSheetField", target_id=field.id, metadata={"label": field.label})
    return serialize_field(field)


@router.put("/fields/{field_id}")
def update_field(
    field_id: str,
    payload: SheetFieldPayload,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    field = _get_field(db, field_id)
    _apply_field_payload(field, payload)
    db.commit()
    log_audit(db, actor_id=actor.id, action="consultation_sheet_field.update", target_type="ConsultationSheetField", target_id=field.id, metadata={"label": field.label})
    return serialize_field(field)


@router.delete("/fields/{field_id}")
def delete_field(
    field_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Arhivează câmpul — valorile deja completate pe fișele vechi se păstrează."""
    field = _get_field(db, field_id)
    field.archived = True
    db.commit()
    log_audit(db, actor_id=actor.id, action="consultation_sheet_field.delete", target_type="ConsultationSheetField", target_id=field.id, metadata={"label": field.label})
    return {"ok": True}


@router.post("/fields/{field_id}/move")
def move_field(
    field_id: str,
    payload: MovePayload,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    field = _get_field(db, field_id)
    fields = (
        db.query(ConsultationSheetField)
        .filter(ConsultationSheetField.archived.is_(False))
        .order_by(ConsultationSheetField.position, ConsultationSheetField.created_at)
        .all()
    )
    i = fields.index(field)
    j = i - 1 if payload.direction == "up" else i + 1
    if 0 <= j < len(fields):
        fields[i], fields[j] = fields[j], fields[i]
    # Renumerotează tot, ca pozițiile să rămână consecutive.
    for position, f in enumerate(fields):
        f.position = position
    db.commit()
    return {"ok": True}


# --- Fișele ---


class ConsultationSheetFields(BaseModel):
    sheet_date: datetime | None = None
    sheet_number: str | None = Field(default=None, max_length=30)
    values: dict[str, str | None] = Field(default_factory=dict)


class ConsultationSheetCreate(ConsultationSheetFields):
    client_id: str


def _clean_values(db: DBSession, values: dict[str, str | None]) -> dict[str, str | None]:
    known = {fid for (fid,) in db.query(ConsultationSheetField.id)}
    cleaned: dict[str, str | None] = {}
    for key, value in values.items():
        if key not in known:
            raise HTTPException(status_code=422, detail="Câmp necunoscut în fișă.")
        value = (value or "").strip() or None
        if value and len(value) > MAX_VALUE_LENGTH:
            raise HTTPException(status_code=422, detail=f"Textul unui câmp depășește {MAX_VALUE_LENGTH} de caractere.")
        cleaned[key] = value
    return cleaned


def _merge_values(current: dict | None, updates: dict[str, str | None]) -> dict[str, str]:
    """Câmpurile netrimise (ex: arhivate) își păstrează valoarea; cele golite dispar."""
    merged = dict(current or {})
    for key, value in updates.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    return merged


@router.post("")
def create_consultation_sheet(
    payload: ConsultationSheetCreate,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    if not db.get(ClientProfile, payload.client_id):
        raise HTTPException(status_code=404, detail="Client inexistent.")
    sheet = ConsultationSheet(
        client_id=payload.client_id,
        author_id=actor.id,
        sheet_date=payload.sheet_date or datetime.now(timezone.utc),
        sheet_number=(payload.sheet_number or "").strip() or None,
        field_values=_merge_values({}, _clean_values(db, payload.values)),
    )
    db.add(sheet)
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="consultation_sheet.create",
        target_type="ConsultationSheet",
        target_id=sheet.id,
        metadata={"client_id": payload.client_id},
    )
    return {"ok": True, "id": sheet.id}


@router.put("/{sheet_id}")
def update_consultation_sheet(
    sheet_id: str,
    payload: ConsultationSheetFields,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    sheet = db.get(ConsultationSheet, sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Fișă inexistentă.")
    sheet.sheet_date = payload.sheet_date or sheet.sheet_date
    sheet.sheet_number = (payload.sheet_number or "").strip() or None
    sheet.field_values = _merge_values(sheet.field_values, _clean_values(db, payload.values))
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="consultation_sheet.update",
        target_type="ConsultationSheet",
        target_id=sheet_id,
        metadata={"client_id": sheet.client_id},
    )
    return {"ok": True}
