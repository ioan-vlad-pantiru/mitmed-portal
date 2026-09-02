from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session as DBSession, joinedload

import secrets
import string

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import AccountStatus, ClientProfile, MedicalRecord, Payment, Appointment, Role, User
from app.security import hash_password

router = APIRouter(tags=["clients"])


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    phone: str | None
    email: str
    status: AccountStatus


class PendingUser(BaseModel):
    id: str
    email: str
    full_name: str | None


class CreateClientRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8)


class NotesRequest(BaseModel):
    notes: str


class MedicalHistoryRequest(BaseModel):
    allergies: str | None = None
    conditions: str | None = None
    medications: str | None = None
    previous_injuries: str | None = None
    notes: str | None = None


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


@router.get("/clients")
def list_clients(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[ClientSummary]:
    clients = db.query(ClientProfile).options(joinedload(ClientProfile.user)).order_by(ClientProfile.created_at.desc()).all()
    return [
        ClientSummary(id=c.id, full_name=c.full_name, phone=c.phone, email=c.user.email, status=c.user.status)
        for c in clients
    ]


@router.get("/clients/pending")
def list_pending_clients(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[PendingUser]:
    users = (
        db.query(User)
        .options(joinedload(User.client_profile))
        .filter(User.role == Role.CLIENT, User.status == AccountStatus.PENDING)
        .order_by(User.created_at.asc())
        .all()
    )
    return [PendingUser(id=u.id, email=u.email, full_name=u.client_profile.full_name if u.client_profile else None) for u in users]


@router.post("/clients/{user_id}/approve")
def approve_client(
    user_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Cont inexistent.")
    user.status = AccountStatus.ACTIVE
    db.commit()
    log_audit(db, actor_id=actor.id, action="client.approve", target_type="User", target_id=user_id)
    return {"ok": True}


@router.post("/clients/{user_id}/suspend")
def suspend_client(
    user_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Cont inexistent.")
    user.status = AccountStatus.SUSPENDED
    db.commit()
    log_audit(db, actor_id=actor.id, action="client.suspend", target_type="User", target_id=user_id)
    return {"ok": True}


@router.post("/clients/{user_id}/reset-password")
def reset_client_password(
    user_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    """Generează o parolă temporară nouă și o întoarce O SINGURĂ DATĂ, ca
    admin/recepția s-o comunice clientului (telefon/WhatsApp) — nu există
    încă un flux self-service de "am uitat parola" (necesită email/SMS)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Cont inexistent.")

    new_password = _generate_temp_password()
    user.password_hash = hash_password(new_password)
    db.commit()

    log_audit(db, actor_id=actor.id, action="client.reset_password", target_type="User", target_id=user_id)
    return {"ok": True, "new_password": new_password}


@router.post("/clients", status_code=status.HTTP_201_CREATED)
def create_client_account(
    payload: CreateClientRequest,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Există deja un cont cu acest email.")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=Role.CLIENT,
        status=AccountStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    db.add(ClientProfile(user_id=user.id, full_name=payload.full_name, phone=payload.phone))
    db.commit()

    log_audit(db, actor_id=actor.id, action="client.create_manual", target_type="User", target_id=user.id)
    return {"ok": True, "message": "Cont client creat și activ."}


@router.get("/clients/me")
def get_own_client_data(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> dict:
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții au fișă proprie.")

    client = (
        db.query(ClientProfile)
        .options(
            joinedload(ClientProfile.medical_records).joinedload(MedicalRecord.therapy),
            joinedload(ClientProfile.payments).joinedload(Payment.therapy),
            joinedload(ClientProfile.appointments).joinedload(Appointment.therapy),
        )
        .filter(ClientProfile.id == user.client_profile.id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Fișă inexistentă.")

    log_audit(db, actor_id=user.id, action="medical_record.read_own", target_type="ClientProfile", target_id=client.id)
    return _serialize_client_detail(client)


@router.get("/clients/{client_id}")
def get_client_detail(
    client_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    client = (
        db.query(ClientProfile)
        .options(
            joinedload(ClientProfile.user),
            joinedload(ClientProfile.medical_records).joinedload(MedicalRecord.therapy),
            joinedload(ClientProfile.medical_records).joinedload(MedicalRecord.author),
            joinedload(ClientProfile.payments).joinedload(Payment.therapy),
            joinedload(ClientProfile.payments).joinedload(Payment.coupon),
            joinedload(ClientProfile.appointments).joinedload(Appointment.therapy),
        )
        .filter(ClientProfile.id == client_id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")

    log_audit(db, actor_id=actor.id, action="medical_record.read", target_type="ClientProfile", target_id=client.id)
    result = _serialize_client_detail(client)
    result["user"] = {"id": client.user.id, "email": client.user.email, "status": client.user.status}
    return result


@router.patch("/clients/me/medical-history")
def update_own_medical_history(
    payload: MedicalHistoryRequest, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    """Chestionarul medical pre-consultație, completat chiar de client."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții își pot completa chestionarul.")

    client = db.get(ClientProfile, user.client_profile.id)
    client.medical_history = payload.model_dump(exclude_none=True)
    db.commit()

    log_audit(
        db, actor_id=user.id, action="client.update_medical_history", target_type="ClientProfile", target_id=client.id
    )
    return {"ok": True}


@router.patch("/clients/{client_id}/notes")
def update_client_notes(
    client_id: str,
    payload: NotesRequest,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")
    client.notes = payload.notes
    db.commit()
    log_audit(db, actor_id=actor.id, action="client.update_notes", target_type="ClientProfile", target_id=client_id)
    return {"ok": True}


@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    from app.models import AppointmentStatus

    active_clients = db.query(User).filter(User.role == Role.CLIENT, User.status == AccountStatus.ACTIVE).count()
    pending = db.query(User).filter(User.role == Role.CLIENT, User.status == AccountStatus.PENDING).count()
    active_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.PROGRAMATA).count()

    return {"active_clients": active_clients, "pending": pending, "active_appointments": active_appointments}


def _serialize_client_detail(client: ClientProfile) -> dict:
    return {
        "id": client.id,
        "full_name": client.full_name,
        "phone": client.phone,
        "emergency_contact_name": client.emergency_contact_name,
        "emergency_contact_phone": client.emergency_contact_phone,
        "notes": client.notes,
        "medical_history": client.medical_history,
        "medical_records": [
            {
                "id": r.id,
                "session_date": r.session_date,
                "diagnosis": r.diagnosis,
                "notes": r.notes,
                "treatment_plan": r.treatment_plan,
                "body_map": r.body_map,
                "therapy": {"name": r.therapy.name} if r.therapy else None,
                "author": {"email": r.author.email} if r.author else None,
            }
            for r in sorted(client.medical_records, key=lambda r: r.session_date, reverse=True)
        ],
        "payments": [
            {
                "id": p.id,
                "created_at": p.created_at,
                "base_price": str(p.base_price),
                "discount_amount": str(p.discount_amount),
                "final_price": str(p.final_price),
                "status": p.status,
                "therapy": {"name": p.therapy.name},
                "coupon": {"code": p.coupon.code} if p.coupon else None,
                "package_total_sessions": p.package_total_sessions,
                "sessions_used": p.sessions_used,
            }
            for p in sorted(client.payments, key=lambda p: p.created_at, reverse=True)
        ],
        "appointments": [
            {
                "id": a.id,
                "starts_at": a.starts_at,
                "status": a.status,
                "therapy_id": a.therapy_id,
                "therapy": {"name": a.therapy.name},
            }
            for a in sorted(client.appointments, key=lambda a: a.starts_at, reverse=True)
        ],
    }
