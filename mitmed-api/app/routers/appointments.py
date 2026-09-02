from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import Appointment, AppointmentStatus, ClientProfile, Role, Therapy, User
from app.services.google_calendar import sync_appointment_cancelled, sync_appointment_created

router = APIRouter(prefix="/appointments", tags=["appointments"])


class OwnAppointmentIn(BaseModel):
    therapy_id: str
    starts_at: datetime


class StaffAppointmentIn(BaseModel):
    client_id: str
    therapy_id: str
    starts_at: datetime


def _create_appointment(db: DBSession, *, client_id: str, therapy_id: str, starts_at: datetime, created_by_id: str) -> Appointment:
    therapy = db.get(Therapy, therapy_id)
    if not therapy or not therapy.active:
        raise HTTPException(status_code=422, detail="Terapia selectată nu este disponibilă.")

    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=422, detail="Client inexistent.")

    google_event_id = None
    try:
        google_event_id = sync_appointment_created(
            summary=f"{therapy.name} — {client.full_name}",
            description=f"Programare MitMed pentru {client.full_name}",
            starts_at=starts_at,
            duration_minutes=therapy.duration_minutes,
        )
    except Exception as err:  # noqa: BLE001
        print(f"[google_calendar] sincronizare eșuată: {err}")

    appointment = Appointment(
        client_id=client_id,
        therapy_id=therapy_id,
        starts_at=starts_at,
        created_by_id=created_by_id,
        google_calendar_event_id=google_event_id,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    log_audit(
        db,
        actor_id=created_by_id,
        action="appointment.create",
        target_type="Appointment",
        target_id=appointment.id,
        metadata={"client_id": client_id},
    )
    return appointment


@router.post("/me")
def create_own_appointment(
    payload: OwnAppointmentIn, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot face programări din contul lor.")

    appointment = _create_appointment(
        db,
        client_id=user.client_profile.id,
        therapy_id=payload.therapy_id,
        starts_at=payload.starts_at,
        created_by_id=user.id,
    )
    return {"ok": True, "id": appointment.id}


@router.post("/staff")
def create_appointment_for_client(
    payload: StaffAppointmentIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    appointment = _create_appointment(
        db,
        client_id=payload.client_id,
        therapy_id=payload.therapy_id,
        starts_at=payload.starts_at,
        created_by_id=actor.id,
    )
    return {"ok": True, "id": appointment.id}


@router.post("/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Programare inexistentă.")

    appointment.status = AppointmentStatus.ANULATA
    db.commit()

    sync_appointment_cancelled(appointment.google_calendar_event_id)

    log_audit(db, actor_id=actor.id, action="appointment.cancel", target_type="Appointment", target_id=appointment_id)
    return {"ok": True}


@router.get("")
def list_appointments_in_range(
    start: datetime,
    end: datetime,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.client), joinedload(Appointment.therapy))
        .filter(Appointment.starts_at >= start, Appointment.starts_at < end)
        .order_by(Appointment.starts_at.asc())
        .all()
    )
    return [
        {
            "id": a.id,
            "client_id": a.client_id,
            "client_name": a.client.full_name,
            "therapy_id": a.therapy_id,
            "therapy_name": a.therapy.name,
            "starts_at": a.starts_at,
            "duration_minutes": a.therapy.duration_minutes,
            "status": a.status,
        }
        for a in appointments
    ]
