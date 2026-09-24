import secrets
import string
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_user
from app.rate_limit import limiter
from app.models import AccountStatus, ClientProfile, PendingRegistration, Role, User, UserSession
from app.security import (
    create_session,
    delete_session_cookie,
    hash_password,
    is_locked_out,
    register_failed_login,
    register_successful_login,
    verify_password,
)
from app.services.notifications import send_otp

router = APIRouter(prefix="/auth", tags=["auth"])

# Vârsta minimă la care un client își poate crea singur cont (vârsta pentru
# consimțământul digital propriu conform Legii 190/2018 care pune în aplicare
# GDPR în România). Sub această vârstă, înregistrarea trebuie făcută de
# recepție împreună cu un părinte/tutore (cont creat manual din /admin).
MIN_SELF_REGISTRATION_AGE = 16

# Auto-înregistrarea se face în doi pași: /register trimite un cod pe WhatsApp,
# /register/verify îl confirmă și abia atunci creează contul, deja ACTIV —
# telefonul verificat înlocuiește aprobarea manuală de recepție de dinainte
# (un telefon real, capabil să primească mesaje, e o dovadă suficientă că nu e
# un cont fals, și nu cere nici email, nici așteptare — important pentru
# clienții vârstnici care pot să nu aibă adresă de email deloc).
OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=10)
MAX_OTP_ATTEMPTS = 5


def _generate_otp() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(OTP_LENGTH))


def _age_years(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1)
    password: str


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr | None = None
    phone: str = Field(min_length=6)
    password: str = Field(min_length=8)
    birth_date: date
    accepted_privacy_policy: bool

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return value.strip()

    @field_validator("accepted_privacy_policy")
    @classmethod
    def _must_accept_privacy_policy(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Trebuie să confirmi că ai citit Politica de confidențialitate.")
        return value

    @field_validator("birth_date")
    @classmethod
    def _must_meet_minimum_age(cls, value: date) -> date:
        if _age_years(value) < MIN_SELF_REGISTRATION_AGE:
            raise ValueError(
                f"Auto-înregistrarea necesită vârsta minimă de {MIN_SELF_REGISTRATION_AGE} ani. "
                "Pentru un minor, contul se creează la recepție, cu acordul unui părinte/tutore."
            )
        return value


class VerifyRegistrationRequest(BaseModel):
    phone: str = Field(min_length=6)
    code: str = Field(min_length=1)


class ResendCodeRequest(BaseModel):
    phone: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MeResponse(BaseModel):
    id: str
    email: str | None
    role: Role
    status: AccountStatus
    full_name: str | None = None
    client_profile_id: str | None = None


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: DBSession = Depends(get_db)) -> MeResponse:
    identifier = payload.identifier.strip()
    user = None
    if "@" in identifier:
        user = db.query(User).filter(User.email == identifier.lower()).first()
    else:
        user = (
            db.query(User)
            .join(ClientProfile, ClientProfile.user_id == User.id)
            .filter(ClientProfile.phone == identifier)
            .first()
        )

    # Același mesaj generic indiferent dacă emailul nu există, parola e
    # greșită sau contul e blocat temporar — altfel se scurge informație
    # despre ce conturi există / sunt sub atac.
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email sau parolă incorectă.")
    locked_error = HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Prea multe încercări eșuate. Contul este blocat temporar — reîncearcă în 15 minute.",
    )

    if not user:
        raise generic_error

    if is_locked_out(user):
        raise locked_error

    if not verify_password(user.password_hash, payload.password):
        register_failed_login(db, user)
        raise generic_error

    register_successful_login(db, user)

    if user.status == AccountStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contul tău așteaptă aprobarea recepției. Revino mai târziu.",
        )
    if user.status == AccountStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acest cont este suspendat.")

    create_session(db, response, user.id)
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        full_name=user.client_profile.full_name if user.client_profile else None,
        client_profile_id=user.client_profile.id if user.client_profile else None,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def register(request: Request, payload: RegisterRequest, db: DBSession = Depends(get_db)) -> dict:
    if payload.email:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Există deja un cont cu acest email.")

    existing_phone = db.query(ClientProfile).filter(ClientProfile.phone == payload.phone).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Există deja un cont cu acest număr de telefon."
        )

    code = _generate_otp()
    pending = db.query(PendingRegistration).filter(PendingRegistration.phone == payload.phone).first()
    if not pending:
        pending = PendingRegistration(phone=payload.phone)
        db.add(pending)
    pending.full_name = payload.full_name
    pending.email = payload.email.lower() if payload.email else None
    pending.password_hash = hash_password(payload.password)
    pending.birth_date = datetime.combine(payload.birth_date, time.min, tzinfo=timezone.utc)
    pending.code_hash = hash_password(code)
    pending.expires_at = datetime.now(timezone.utc) + OTP_TTL
    pending.attempts = 0
    db.commit()

    if not send_otp(payload.phone, code):
        # Nu ascundem eșecul — altfel clientul așteaptă la nesfârșit un cod
        # care n-a plecat niciodată (ex: numărul nu are WhatsApp, template-ul
        # nu e încă aprobat, sau Meta e picat). Rândul PendingRegistration rămâne —
        # /register/resend sau un nou /register pot încerca din nou fără să
        # retasteze totul.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nu am putut trimite codul pe WhatsApp la acest număr. Verifică numărul sau încearcă din nou în "
            "câteva minute — dacă problema persistă, sună la recepție.",
        )

    return {"message": "Ți-am trimis un cod pe WhatsApp la numărul indicat.", "phone": payload.phone}


@router.post("/register/verify")
@limiter.limit("10/hour")
def verify_registration(
    request: Request, payload: VerifyRegistrationRequest, response: Response, db: DBSession = Depends(get_db)
) -> MeResponse:
    """Confirmă codul primit și creează contul, deja ACTIV — verificarea
    telefonului e ce înlocuiește aprobarea manuală de recepție (vezi
    comentariul de la OTP_TTL mai sus)."""
    phone = payload.phone.strip()
    generic_error = HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cod incorect.")

    pending = db.query(PendingRegistration).filter(PendingRegistration.phone == phone).first()
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Nicio înregistrare în așteptare pentru acest telefon."
        )

    if pending.expires_at < datetime.now(timezone.utc):
        db.delete(pending)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Codul a expirat — solicită unul nou."
        )

    if pending.attempts >= MAX_OTP_ATTEMPTS:
        db.delete(pending)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Prea multe coduri greșite — solicită unul nou.",
        )

    if not verify_password(pending.code_hash, payload.code.strip()):
        pending.attempts += 1
        db.commit()
        raise generic_error

    user = User(
        email=pending.email,
        password_hash=pending.password_hash,
        role=Role.CLIENT,
        status=AccountStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    client_profile = ClientProfile(
        user_id=user.id,
        full_name=pending.full_name,
        phone=pending.phone,
        birth_date=pending.birth_date,
    )
    db.add(client_profile)
    db.delete(pending)
    db.commit()
    db.refresh(user)
    db.refresh(client_profile)

    # Dovadă că politica de confidențialitate a fost prezentată și acceptată
    # la momentul colectării datelor (GDPR Art. 13) — separată de
    # consimțământul de tratament, care se semnează din portal.
    log_audit(
        db,
        actor_id=user.id,
        action="privacy_policy.accept",
        target_type="User",
        target_id=user.id,
        metadata={"at_registration": True},
    )
    log_audit(db, actor_id=user.id, action="user.phone_verified", target_type="User", target_id=user.id)

    create_session(db, response, user.id)
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        full_name=client_profile.full_name,
        client_profile_id=client_profile.id,
    )


@router.post("/register/resend")
@limiter.limit("3/hour")
def resend_registration_code(request: Request, payload: ResendCodeRequest, db: DBSession = Depends(get_db)) -> dict:
    pending = db.query(PendingRegistration).filter(PendingRegistration.phone == payload.phone.strip()).first()
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Nicio înregistrare în așteptare pentru acest telefon."
        )

    code = _generate_otp()
    pending.code_hash = hash_password(code)
    pending.expires_at = datetime.now(timezone.utc) + OTP_TTL
    pending.attempts = 0
    db.commit()

    if not send_otp(pending.phone, code):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nu am putut retrimite codul pe WhatsApp. Încearcă din nou în câteva minute — dacă problema "
            "persistă, sună la recepție.",
        )
    return {"message": "Cod retrimis."}


@router.post("/logout")
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)) -> dict:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        session = db.get(UserSession, token)
        if session:
            db.delete(session)
            db.commit()
    delete_session_cookie(response)
    return {"ok": True}


@router.post("/change-password")
@limiter.limit("5/hour")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
) -> dict:
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Parola curentă este incorectă.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    log_audit(db, actor_id=user.id, action="user.change_password", target_type="User", target_id=user.id)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(require_user)) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        full_name=user.client_profile.full_name if user.client_profile else None,
        client_profile_id=user.client_profile.id if user.client_profile else None,
    )
