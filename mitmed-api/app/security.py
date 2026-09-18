from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Response
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.models import User, UserSession

_hasher = PasswordHasher()

# După acest număr de autentificări eșuate consecutive, contul se blochează
# temporar — protecție împotriva brute-force/credential-stuffing pe conturi
# care conțin date medicale. Blocarea e per-cont (nu per-IP), ținută în DB.
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def is_locked_out(user: User) -> bool:
    return bool(user.locked_until and user.locked_until > datetime.now(timezone.utc))


def register_failed_login(db: DBSession, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + LOCKOUT_DURATION
        user.failed_login_attempts = 0
    db.commit()


def register_successful_login(db: DBSession, user: User) -> None:
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()


def create_session(db: DBSession, response: Response, user_id: str) -> UserSession:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_duration_days)
    session = UserSession(user_id=user_id, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)

    # Cookie-ul poartă doar id-ul opac de sesiune (deja suficient de random —
    # secrets.token_urlsafe(16) ~ 128 biți), nicio dată de utilizator/rol.
    # Sesiunea trăiește în DB, deci poate fi revocată instant.
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session.id,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_duration_days * 24 * 60 * 60,
        path="/",
    )
    return session


def delete_session_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name, path="/")
