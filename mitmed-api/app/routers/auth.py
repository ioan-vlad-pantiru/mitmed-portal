from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_user
from app.models import AccountStatus, ClientProfile, Role, User, UserSession
from app.security import create_session, delete_session_cookie, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8)


class MeResponse(BaseModel):
    id: str
    email: str
    role: Role
    status: AccountStatus
    full_name: str | None = None
    client_profile_id: str | None = None


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: DBSession = Depends(get_db)) -> MeResponse:
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Același mesaj generic indiferent dacă emailul nu există sau parola e
    # greșită — altfel se scurge informație despre ce conturi există.
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email sau parolă incorectă.")

    if not user or not verify_password(user.password_hash, payload.password):
        raise generic_error

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
def register(payload: RegisterRequest, db: DBSession = Depends(get_db)) -> dict:
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
    db.add(ClientProfile(user_id=user.id, full_name=payload.full_name, phone=payload.phone))
    db.commit()

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
