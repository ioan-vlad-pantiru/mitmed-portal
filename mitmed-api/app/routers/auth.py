from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_user
from app.rate_limit import limiter
from app.models import AccountStatus, ClientProfile, Role, User, UserSession
from app.security import (
    create_session,
    delete_session_cookie,
    hash_password,
    is_locked_out,
    register_failed_login,
    register_successful_login,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Vârsta minimă la care un client își poate crea singur cont (vârsta pentru
# consimțământul digital propriu conform Legii 190/2018 care pune în aplicare
# GDPR în România). Sub această vârstă, înregistrarea trebuie făcută de
# recepție împreună cu un părinte/tutore (cont creat manual din /admin).
MIN_SELF_REGISTRATION_AGE = 16


def _age_years(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8)
    birth_date: date
    accepted_privacy_policy: bool

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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MeResponse(BaseModel):
    id: str
    email: str
    role: Role
    status: AccountStatus
    full_name: str | None = None
    client_profile_id: str | None = None


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: DBSession = Depends(get_db)) -> MeResponse:
    user = db.query(User).filter(User.email == payload.email.lower()).first()

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
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Există deja un cont cu acest email.")

    # Auto-înregistrare -> PENDING, aprobat manual de admin/recepție (evită
    # conturi false pe un sistem cu date medicale).
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=Role.CLIENT,
        status=AccountStatus.PENDING,
    )
    db.add(user)
    db.flush()
    db.add(
        ClientProfile(
            user_id=user.id,
            full_name=payload.full_name,
            phone=payload.phone,
            birth_date=datetime.combine(payload.birth_date, time.min, tzinfo=timezone.utc),
        )
    )
    db.commit()

    # Dovadă că politica de confidențialitate a fost prezentată și acceptată
    # la momentul colectării datelor (GDPR Art. 13) — separată de
    # consimțământul de tratament, care se semnează abia după aprobare.
    log_audit(
        db,
        actor_id=user.id,
        action="privacy_policy.accept",
        target_type="User",
        target_id=user.id,
        metadata={"at_registration": True},
    )

    return {"message": "Cont creat. Recepția va aproba contul înainte să te poți autentifica."}


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
