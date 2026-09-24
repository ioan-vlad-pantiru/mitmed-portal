from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import ClientProfile, ConsultationSheet, Role, User

router = APIRouter(prefix="/consultation-sheets", tags=["consultation-sheets"])


class ConsultationSheetFields(BaseModel):
    sheet_date: datetime | None = None
    sheet_number: str | None = Field(default=None, max_length=30)
    marital_status: str | None = Field(default=None, max_length=50)
    antecedents: str | None = Field(default=None, max_length=4000)
    working_conditions: str | None = Field(default=None, max_length=4000)
    blood_pressure: str | None = Field(default=None, max_length=30)
    pulse: str | None = Field(default=None, max_length=30)
    oxygen_saturation: str | None = Field(default=None, max_length=30)
    glycemia: str | None = Field(default=None, max_length=30)
    symptoms: str | None = Field(default=None, max_length=4000)
    diagnosis: str | None = Field(default=None, max_length=4000)
    recommendations: str | None = Field(default=None, max_length=4000)


class ConsultationSheetCreate(ConsultationSheetFields):
    client_id: str


def _clean(fields: ConsultationSheetFields) -> dict:
    data = fields.model_dump(exclude={"client_id"})
    for key, value in data.items():
        if isinstance(value, str):
            data[key] = value.strip() or None
    return data


@router.post("")
def create_consultation_sheet(
    payload: ConsultationSheetCreate,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    if not db.get(ClientProfile, payload.client_id):
        raise HTTPException(status_code=404, detail="Client inexistent.")
    data = _clean(payload)
    data["sheet_date"] = data["sheet_date"] or datetime.now(timezone.utc)
    sheet = ConsultationSheet(client_id=payload.client_id, author_id=actor.id, **data)
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
    data = _clean(payload)
    data["sheet_date"] = data["sheet_date"] or sheet.sheet_date
    for key, value in data.items():
        setattr(sheet, key, value)
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
