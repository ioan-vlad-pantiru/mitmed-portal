from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session as DBSession, joinedload

import secrets
import string

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import (
    AccountStatus,
    ClientProfile,
    DataRequestStatus,
    DataRequestType,
    DataSubjectRequest,
    MedicalRecord,
    Payment,
    Appointment,
    Role,
    User,
)
from app.security import hash_password

router = APIRouter(tags=["clients"])


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    phone: str | None
    email: str | None
    status: AccountStatus


class PendingUser(BaseModel):
    id: str
    email: str | None
    full_name: str | None


class CreateClientRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr | None = None
    phone: str = Field(min_length=6)
    password: str = Field(min_length=8)


class NotesRequest(BaseModel):
    notes: str


class MedicalHistoryRequest(BaseModel):
    allergies: str | None = None
    conditions: str | None = None
    medications: str | None = None
    previous_injuries: str | None = None
    notes: str | None = None


class ClientProfileDataRequest(BaseModel):
    """Date neclinice, opționale, pe care clientul le poate actualiza singur."""

    model_config = ConfigDict(extra="forbid")

    birth_date: date | None = None
    gender: Literal["FEMININ", "MASCULIN", "NU_DORESC_SA_SPUN"] | None = None
    city: str | None = Field(default=None, max_length=100)
    county: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=300)
    occupation: str | None = Field(default=None, max_length=120)
    occupation_category: Literal["SEDENTAR", "ACTIV", "MUNCA_FIZICA", "PENSIONAR", "ELEV_STUDENT", "ALTELE"] | None = None
    preferred_contact: Literal["TELEFON", "SMS", "WHATSAPP", "EMAIL"] | None = None
    preferred_language: Literal["ROMANA", "ENGLEZA"] | None = None
    referral_source: Literal[
        "RECOMANDARE", "GOOGLE", "FACEBOOK_INSTAGRAM", "SITE", "MEDIC", "EVENIMENT", "ALTELE"
    ] | None = None
    referral_details: str | None = Field(default=None, max_length=150)
    activity_level: Literal["SCĂZUT", "MODERAT", "RIDICAT"] | None = None
    primary_goal: Literal[
        "DURERE", "MOBILITATE", "RECUPERARE", "PREVENȚIE", "PERFORMANȚĂ", "STARE_DE_BINE", "ALTELE"
    ] | None = None
    secondary_goal: str | None = Field(default=None, max_length=150)
    communication_consent: bool = False


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
    if payload.email:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=409, detail="Există deja un cont cu acest email.")

    existing_phone = db.query(ClientProfile).filter(ClientProfile.phone == payload.phone).first()
    if existing_phone:
        raise HTTPException(status_code=409, detail="Există deja un cont cu acest număr de telefon.")

    user = User(
        email=payload.email.lower() if payload.email else None,
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


@router.get("/clients/me/export")
def export_own_data(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> dict:
    """Autoservire GDPR Art. 15 (dreptul de acces) — o copie completă, imediată,
    a datelor deținute despre client: profil, chestionar medical, fișe
    clinice, programări, plăți și declarații semnate. Nu necesită intervenția
    recepției, spre deosebire de ștergere (vezi request_own_data_erasure mai
    jos), care e mereu revizuită manual."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții își pot exporta datele.")

    client = (
        db.query(ClientProfile)
        .options(
            joinedload(ClientProfile.medical_records).joinedload(MedicalRecord.therapy),
            joinedload(ClientProfile.payments).joinedload(Payment.therapy),
            joinedload(ClientProfile.appointments).joinedload(Appointment.therapy),
            joinedload(ClientProfile.consents),
        )
        .filter(ClientProfile.id == user.client_profile.id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Fișă inexistentă.")

    data = _serialize_client_detail(client)
    data["account"] = {"email": user.email, "created_at": user.created_at}
    data["consents"] = [
        {
            "type": c.type,
            "version_text": c.version_text,
            "signed_at": c.signed_at,
            "withdrawn_at": c.withdrawn_at,
        }
        for c in sorted(client.consents, key=lambda c: c.signed_at, reverse=True)
    ]

    log_audit(db, actor_id=user.id, action="data_request.export", target_type="ClientProfile", target_id=client.id)
    return data


@router.post("/clients/me/erasure-request", status_code=status.HTTP_201_CREATED)
def request_own_data_erasure(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> dict:
    """Autoservire GDPR Art. 17 (dreptul la ștergere). NU șterge nimic automat:
    fișele medicale și financiare trebuie păstrate conform obligațiilor legale
    de arhivare (Art. 17(3)(b)), iar decizia despre ce anume se poate anonimiza
    fără a încălca acele obligații necesită judecata unui om — vezi
    complete_erasure_request, execuția manuală de admin."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot solicita ștergerea contului.")

    existing = (
        db.query(DataSubjectRequest)
        .filter(
            DataSubjectRequest.client_id == user.client_profile.id,
            DataSubjectRequest.type == DataRequestType.ERASURE,
            DataSubjectRequest.status == DataRequestStatus.PENDING,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ai deja o cerere de ștergere în curs de soluționare.")

    request = DataSubjectRequest(
        client_id=user.client_profile.id, type=DataRequestType.ERASURE, status=DataRequestStatus.PENDING
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    log_audit(
        db, actor_id=user.id, action="data_request.erasure_requested", target_type="ClientProfile",
        target_id=user.client_profile.id,
    )
    return {"ok": True, "id": request.id, "message": "Cererea a fost înregistrată. Recepția o va soluționa în cel mult 30 de zile."}


@router.get("/data-subject-requests")
def list_data_subject_requests(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[dict]:
    requests = (
        db.query(DataSubjectRequest)
        .options(joinedload(DataSubjectRequest.client))
        .filter(DataSubjectRequest.status == DataRequestStatus.PENDING)
        .order_by(DataSubjectRequest.created_at.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "client_id": r.client_id,
            "client_name": r.client.full_name,
            "type": r.type,
            "created_at": r.created_at,
        }
        for r in requests
    ]


@router.post("/data-subject-requests/{request_id}/complete")
def complete_erasure_request(
    request_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    """Execută ștergerea: anonimizează datele de identificare/contact și
    chestionarul medical neclinice; PĂSTREAZĂ fișele clinice (obligație legală
    de arhivare a documentației medicale) și plățile (obligație fiscală de
    arhivare), dar acestea nu mai pot fi asociate unei persoane identificabile
    din portal odată ce contul e suspendat și emailul/telefonul anonimizate."""
    request = db.get(DataSubjectRequest, request_id)
    if not request or request.status != DataRequestStatus.PENDING:
        raise HTTPException(status_code=404, detail="Cerere inexistentă sau deja soluționată.")

    client = db.get(ClientProfile, request.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")

    user = client.user
    anonymized_email = f"sters-{client.id}@anonimizat.mitmed.local"
    user.email = anonymized_email
    user.status = AccountStatus.SUSPENDED
    client.full_name = "Client șters (cerere GDPR)"
    client.phone = None
    client.emergency_contact_name = None
    client.emergency_contact_phone = None
    client.medical_history = None
    client.profile_data = None
    client.notes = None

    request.status = DataRequestStatus.COMPLETED
    request.resolved_by_id = actor.id
    request.resolved_at = datetime.now(timezone.utc)
    db.commit()

    log_audit(db, actor_id=actor.id, action="data_request.erasure_completed", target_type="ClientProfile", target_id=client.id)
    return {"ok": True}


@router.post("/data-subject-requests/{request_id}/reject")
def reject_data_subject_request(
    request_id: str,
    payload: NotesRequest,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    request = db.get(DataSubjectRequest, request_id)
    if not request or request.status != DataRequestStatus.PENDING:
        raise HTTPException(status_code=404, detail="Cerere inexistentă sau deja soluționată.")

    request.status = DataRequestStatus.REJECTED
    request.note = payload.notes
    request.resolved_by_id = actor.id
    request.resolved_at = datetime.now(timezone.utc)
    db.commit()

    log_audit(db, actor_id=actor.id, action="data_request.rejected", target_type="ClientProfile", target_id=request.client_id, metadata={"note": payload.notes})
    return {"ok": True}


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
            joinedload(ClientProfile.payments).joinedload(Payment.package),
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


@router.patch("/clients/me/profile")
def update_own_profile_data(
    payload: ClientProfileDataRequest, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții își pot actualiza profilul.")

    client = db.get(ClientProfile, user.client_profile.id)
    client.birth_date = (
        datetime.combine(payload.birth_date, time.min, tzinfo=timezone.utc) if payload.birth_date else None
    )
    # `birth_date` este o coloană existentă; restul profilului rămâne într-un
    # singur document limitat și validat, ușor de extins fără migrații frecvente.
    client.profile_data = payload.model_dump(exclude={"birth_date"}, exclude_none=True)
    db.commit()

    log_audit(db, actor_id=user.id, action="client.update_profile", target_type="ClientProfile", target_id=client.id)
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
        "birth_date": client.birth_date,
        "emergency_contact_name": client.emergency_contact_name,
        "emergency_contact_phone": client.emergency_contact_phone,
        "notes": client.notes,
        "medical_history": client.medical_history,
        "profile_data": client.profile_data,
        "medical_records": [
            {
                "id": r.id,
                "session_date": r.session_date,
                "diagnosis": r.diagnosis,
                "subjective": r.subjective,
                "objective": r.objective,
                "assessment": r.assessment,
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
                "package_name": p.package.name if p.package else None,
                "package_purchase_id": p.package_purchase_id,
                "appointment_id": p.appointment_id,
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
