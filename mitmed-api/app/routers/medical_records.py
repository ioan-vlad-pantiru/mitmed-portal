from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import TEMPLATE_TRATAMENT, Appointment, AppointmentStatus, MedicalRecord, Role, User
from app.routers.consultation_sheets import clean_field_values, merge_field_values
from app.services.packages import consume_package_session

router = APIRouter(prefix="/medical-records", tags=["medical-records"])


class BodyMapPoint(BaseModel):
    x: float
    y: float
    label: str | None = None


class MedicalRecordIn(BaseModel):
    client_id: str
    therapy_id: str | None = None
    appointment_id: str | None = None
    diagnosis: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    notes: str
    treatment_plan: str | None = None
    session_date: datetime | None = None
    body_map: list[BodyMapPoint] | None = None
    # Căsuțele fișei de tratament configurate de admin: {field_id: text}.
    field_values: dict[str, str | None] = {}


class MedicalRecordUpdate(BaseModel):
    diagnosis: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    notes: str
    treatment_plan: str | None = None
    body_map: list[BodyMapPoint] | None = None
    field_values: dict[str, str | None] = {}


@router.post("")
def create_medical_record(
    payload: MedicalRecordIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    if not payload.notes.strip():
        raise HTTPException(status_code=422, detail="Notele nu pot fi goale.")

    record = MedicalRecord(
        client_id=payload.client_id,
        author_id=actor.id,
        therapy_id=payload.therapy_id,
        appointment_id=payload.appointment_id,
        diagnosis=payload.diagnosis,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        notes=payload.notes,
        treatment_plan=payload.treatment_plan,
        session_date=payload.session_date or datetime.utcnow(),
        body_map=[p.model_dump() for p in payload.body_map] if payload.body_map else None,
        field_values=merge_field_values({}, clean_field_values(db, TEMPLATE_TRATAMENT, payload.field_values)) or None,
    )
    db.add(record)
    db.flush()

    # Scrierea notițelor pentru o programare o consideră "ținută" — ședința
    # iese din contorul de ședințe active (programate, neefectuate încă).
    if payload.appointment_id:
        appointment = db.get(Appointment, payload.appointment_id)
        if appointment and appointment.status == AppointmentStatus.PROGRAMATA:
            appointment.status = AppointmentStatus.FINALIZATA

    # O notiță de ședință pentru o terapie = o ședință "ținută" — dacă
    # clientul are un pachet activ pentru acea terapie, se scade automat 1.
    if payload.therapy_id:
        consume_package_session(db, client_id=payload.client_id, therapy_id=payload.therapy_id)

    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="medical_record.create",
        target_type="MedicalRecord",
        target_id=record.id,
        metadata={"client_id": payload.client_id, "appointment_id": payload.appointment_id},
    )
    return {"ok": True, "id": record.id}


@router.put("/{record_id}")
def update_medical_record(
    record_id: str,
    payload: MedicalRecordUpdate,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Doar adminul corectează o ședință deja documentată."""
    record = db.get(MedicalRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Intrare inexistentă.")
    if not payload.notes.strip():
        raise HTTPException(status_code=422, detail="Notele nu pot fi goale.")

    record.diagnosis = payload.diagnosis
    record.subjective = payload.subjective
    record.objective = payload.objective
    record.assessment = payload.assessment
    record.notes = payload.notes
    record.treatment_plan = payload.treatment_plan
    if payload.body_map is not None:
        record.body_map = [p.model_dump() for p in payload.body_map]
    record.field_values = (
        merge_field_values(record.field_values, clean_field_values(db, TEMPLATE_TRATAMENT, payload.field_values)) or None
    )
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="medical_record.update",
        target_type="MedicalRecord",
        target_id=record_id,
        metadata={"client_id": record.client_id},
    )
    return {"ok": True}
