from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.database import get_db
from app.models import Role, User, UserSession


def get_current_user(request: Request, db: DBSession = Depends(get_db)) -> User | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None

    session = db.get(UserSession, token)
    if not session:
        return None

    if session.expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        return None

    return session.user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentificare necesară.")
    return user


def require_roles(*roles: Role):
    def _check(user: User = Depends(require_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nu ai acces la această resursă.")
        return user

    return _check
