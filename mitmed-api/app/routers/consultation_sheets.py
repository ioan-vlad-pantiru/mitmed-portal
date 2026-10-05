import re
import unicodedata
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import (
    TEMPLATE_CONSULTATIE,
    TEMPLATE_TRATAMENT,
    ClientProfile,
    ConsultationSheet,
    ConsultationSheetField,
    MedicalRecord,
    Role,
    SheetTemplate,
    User,
)
from app.services.sheet_pdf import render_sheet_pdf, render_treatment_pdf

router = APIRouter(prefix="/consultation-sheets", tags=["consultation-sheets"])

MAX_VALUE_LENGTH = 4000


# --- Tipurile de fișe (șabloane, configurate de admin) ---


class TemplatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    visible_to_client: bool = True


def serialize_template(t: SheetTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "kind": t.kind,
        "description": t.description,
        "visible_to_client": t.visible_to_client,
        "position": t.position,
        "archived": t.archived,
    }


def _get_template(db: DBSession, template_id: str) -> SheetTemplate:
    template = db.get(SheetTemplate, template_id)
    if not template or template.archived:
        raise HTTPException(status_code=404, detail="Tip de fișă inexistent.")
    return template


@router.get("/templates")
def list_templates(
    db: DBSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    templates = (
        db.query(SheetTemplate)
        .filter(SheetTemplate.archived.is_(False))
        .order_by(SheetTemplate.position, SheetTemplate.created_at)
    )
    return [serialize_template(t) for t in templates]


@router.post("/templates")
def create_template(
    payload: TemplatePayload,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Denumirea fișei e obligatorie.")
    last = db.query(func.max(SheetTemplate.position)).scalar()
    template = SheetTemplate(
        name=name,
        kind="custom",
        description=(payload.description or "").strip() or None,
        visible_to_client=payload.visible_to_client,
        position=(last if last is not None else -1) + 1,
    )
    db.add(template)
    db.commit()
    log_audit(db, actor_id=actor.id, action="sheet_template.create", target_type="SheetTemplate", target_id=template.id, metadata={"name": name})
    return serialize_template(template)


@router.put("/templates/{template_id}")
def update_template(
    template_id: str,
    payload: TemplatePayload,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    template = _get_template(db, template_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Denumirea fișei e obligatorie.")
    template.name = name
    template.description = (payload.description or "").strip() or None
    template.visible_to_client = payload.visible_to_client
    db.commit()
    log_audit(db, actor_id=actor.id, action="sheet_template.update", target_type="SheetTemplate", target_id=template.id, metadata={"name": name})
    return serialize_template(template)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Arhivează o fișă construită de admin — fișele deja completate rămân în
    dosarele pacienților. Fișa de consultație și cea de tratament nu se șterg."""
    template = _get_template(db, template_id)
    if template.kind != "custom":
        raise HTTPException(status_code=422, detail="Fișa de consultație și cea de tratament nu pot fi șterse.")
    template.archived = True
    db.commit()
    log_audit(db, actor_id=actor.id, action="sheet_template.delete", target_type="SheetTemplate", target_id=template.id, metadata={"name": template.name})
    return {"ok": True}


# --- Câmpurile fișei (configurate de admin) ---


class SheetFieldPayload(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    field_type: Literal["text", "textarea"] = "textarea"
    section: str | None = Field(default=None, max_length=120)
    placeholder: str | None = Field(default=None, max_length=120)
    carry_over: bool = False


class SheetFieldCreate(SheetFieldPayload):
    template_id: str = TEMPLATE_CONSULTATIE


class MovePayload(BaseModel):
    direction: Literal["up", "down"]


def serialize_field(f: ConsultationSheetField) -> dict:
    return {
        "id": f.id,
        "template_id": f.template_id,
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


def _template_fields(db: DBSession, template_id: str, *, include_archived: bool) -> list[ConsultationSheetField]:
    query = db.query(ConsultationSheetField).filter(ConsultationSheetField.template_id == template_id)
    if not include_archived:
        query = query.filter(ConsultationSheetField.archived.is_(False))
    return query.order_by(ConsultationSheetField.position, ConsultationSheetField.created_at).all()


@router.get("/fields")
def list_fields(
    template_id: str | None = None,
    include_archived: bool = False,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    """Câmpurile unui tip de fișă; fără `template_id`, ale tuturor tipurilor."""
    query = db.query(ConsultationSheetField)
    if template_id:
        query = query.filter(ConsultationSheetField.template_id == template_id)
    if not include_archived:
        query = query.filter(ConsultationSheetField.archived.is_(False))
    return [serialize_field(f) for f in query.order_by(ConsultationSheetField.position, ConsultationSheetField.created_at)]


@router.post("/fields")
def create_field(
    payload: SheetFieldCreate,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    template = _get_template(db, payload.template_id)
    last = (
        db.query(func.max(ConsultationSheetField.position))
        .filter(ConsultationSheetField.template_id == template.id)
        .scalar()
    )
    field = ConsultationSheetField(template_id=template.id, position=(last if last is not None else -1) + 1)
    _apply_field_payload(field, payload)
    db.add(field)
    db.commit()
    log_audit(db, actor_id=actor.id, action="consultation_sheet_field.create", target_type="ConsultationSheetField", target_id=field.id, metadata={"label": field.label, "template_id": template.id})
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
    fields = _template_fields(db, field.template_id, include_archived=False)
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
    template_id: str = TEMPLATE_CONSULTATIE


def clean_field_values(db: DBSession, template_id: str, values: dict[str, str | None]) -> dict[str, str | None]:
    """Valorile trimise trebuie să aparțină câmpurilor acestui tip de fișă."""
    known = {
        fid
        for (fid,) in db.query(ConsultationSheetField.id).filter(ConsultationSheetField.template_id == template_id)
    }
    cleaned: dict[str, str | None] = {}
    for key, value in values.items():
        if key not in known:
            raise HTTPException(status_code=422, detail="Câmp necunoscut în fișă.")
        value = (value or "").strip() or None
        if value and len(value) > MAX_VALUE_LENGTH:
            raise HTTPException(status_code=422, detail=f"Textul unui câmp depășește {MAX_VALUE_LENGTH} de caractere.")
        cleaned[key] = value
    return cleaned


def merge_field_values(current: dict | None, updates: dict[str, str | None]) -> dict[str, str]:
    """Câmpurile netrimise (ex: arhivate) își păstrează valoarea; cele golite dispar."""
    merged = dict(current or {})
    for key, value in updates.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    return merged


def _get_sheet(db: DBSession, sheet_id: str) -> ConsultationSheet:
    sheet = db.get(ConsultationSheet, sheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Fișă inexistentă.")
    return sheet


@router.post("")
def create_consultation_sheet(
    payload: ConsultationSheetCreate,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    if not db.get(ClientProfile, payload.client_id):
        raise HTTPException(status_code=404, detail="Client inexistent.")
    template = _get_template(db, payload.template_id)
    if template.kind == "tratament":
        # Fișa de tratament se completează per ședință (MedicalRecord), nu aici.
        raise HTTPException(status_code=422, detail="Fișa de tratament se completează din ședințe.")
    sheet = ConsultationSheet(
        client_id=payload.client_id,
        template_id=template.id,
        author_id=actor.id,
        sheet_date=payload.sheet_date or datetime.now(timezone.utc),
        sheet_number=(payload.sheet_number or "").strip() or None,
        field_values=merge_field_values({}, clean_field_values(db, template.id, payload.values)),
    )
    db.add(sheet)
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="consultation_sheet.create",
        target_type="ConsultationSheet",
        target_id=sheet.id,
        metadata={"client_id": payload.client_id, "template_id": template.id},
    )
    return {"ok": True, "id": sheet.id}


@router.put("/{sheet_id}")
def update_consultation_sheet(
    sheet_id: str,
    payload: ConsultationSheetFields,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Doar adminul modifică o fișă deja salvată (ex. pacientul revine după o
    lună cu o corectură necesară la comisie)."""
    sheet = _get_sheet(db, sheet_id)
    sheet.sheet_date = payload.sheet_date or sheet.sheet_date
    sheet.sheet_number = (payload.sheet_number or "").strip() or None
    sheet.field_values = merge_field_values(sheet.field_values, clean_field_values(db, sheet.template_id, payload.values))
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


@router.delete("/{sheet_id}")
def delete_consultation_sheet(
    sheet_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    sheet = _get_sheet(db, sheet_id)
    client_id = sheet.client_id
    db.delete(sheet)
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="consultation_sheet.delete",
        target_type="ConsultationSheet",
        target_id=sheet_id,
        metadata={"client_id": client_id},
    )
    return {"ok": True}


# --- PDF ---


def _pdf_filename(*parts: str) -> str:
    text = unicodedata.normalize("NFKD", " ".join(parts)).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower() + ".pdf"


def _pdf_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


def _sheet_pdf(db: DBSession, sheet: ConsultationSheet) -> Response:
    template = db.get(SheetTemplate, sheet.template_id)
    client = db.get(ClientProfile, sheet.client_id)
    fields = _template_fields(db, sheet.template_id, include_archived=True)
    content = render_sheet_pdf(sheet, template, fields, client)
    return _pdf_response(content, _pdf_filename(template.name, client.full_name, sheet.sheet_date.strftime("%Y-%m-%d")))


@router.get("/me/{sheet_id}/pdf")
def download_own_sheet_pdf(
    sheet_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_user),
) -> Response:
    """Pacientul își descarcă propria fișă — doar tipurile marcate vizibile pentru pacient."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții își pot descărca fișele.")
    sheet = db.get(ConsultationSheet, sheet_id)
    if not sheet or sheet.client_id != user.client_profile.id or not sheet.template.visible_to_client:
        raise HTTPException(status_code=404, detail="Fișă inexistentă.")
    log_audit(db, actor_id=user.id, action="consultation_sheet.download_own", target_type="ConsultationSheet", target_id=sheet.id)
    return _sheet_pdf(db, sheet)


@router.get("/treatment/{client_id}/pdf")
def download_treatment_sheet_pdf(
    client_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> Response:
    """Fișa de tratament a pacientului — toate ședințele într-un singur document."""
    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")
    records = (
        db.query(MedicalRecord)
        .options(joinedload(MedicalRecord.therapy))
        .filter(MedicalRecord.client_id == client_id)
        .all()
    )
    template = db.get(SheetTemplate, TEMPLATE_TRATAMENT)
    name = template.name if template else "Fișă de tratament"
    content = render_treatment_pdf(client, records, _template_fields(db, TEMPLATE_TRATAMENT, include_archived=True), name)
    log_audit(db, actor_id=actor.id, action="treatment_sheet.download", target_type="ClientProfile", target_id=client_id)
    return _pdf_response(content, _pdf_filename(name, client.full_name))


@router.get("/{sheet_id}/pdf")
def download_sheet_pdf(
    sheet_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> Response:
    sheet = _get_sheet(db, sheet_id)
    log_audit(db, actor_id=actor.id, action="consultation_sheet.download", target_type="ConsultationSheet", target_id=sheet.id)
    return _sheet_pdf(db, sheet)
