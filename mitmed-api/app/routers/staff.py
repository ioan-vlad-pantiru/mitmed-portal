"""Conturile personalului (admin + recepție) — create și gestionate doar de admin.

Personalul nu se poate înregistra singur: /auth/register creează doar conturi
CLIENT. Până acum singurul cont de personal era adminul din seed.py.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import AccountStatus, Role, User, UserSession
from app.security import hash_password

router = APIRouter(prefix="/staff", tags=["staff"])

STAFF_ROLES = (Role.ADMIN, Role.RECEPTIE)


class StaffOut(BaseModel):
    id: str
    email: str | None
    role: Role
    status: AccountStatus
    created_at: datetime


class StaffIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.RECEPTIE


class StaffStatusIn(BaseModel):
    active: bool


def _serialize(u: User) -> StaffOut:
    return StaffOut(id=u.id, email=u.email, role=u.role, status=u.status, created_at=u.created_at)


@router.get("")
def list_staff(db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN))) -> list[StaffOut]:
    users = db.query(User).filter(User.role.in_(STAFF_ROLES)).order_by(User.created_at).all()
    return [_serialize(u) for u in users]


@router.post("", status_code=201)
def create_staff(
    payload: StaffIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> StaffOut:
    if payload.role not in STAFF_ROLES:
        raise HTTPException(status_code=422, detail="Rolul trebuie să fie Admin sau Recepție.")

    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Există deja un cont cu acest email.")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=AccountStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_audit(
        db, actor_id=actor.id, action="staff.create", target_type="User", target_id=user.id,
        metadata={"role": user.role.value},
    )
    return _serialize(user)


@router.post("/{user_id}/status")
def set_staff_status(
    user_id: str,
    payload: StaffStatusIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> StaffOut:
    user = db.get(User, user_id)
    if not user or user.role not in STAFF_ROLES:
        raise HTTPException(status_code=404, detail="Contul nu există.")
    if user.id == actor.id:
        # Altfel adminul se poate bloca singur pe dinafară.
        raise HTTPException(status_code=400, detail="Nu îți poți suspenda propriul cont.")

    user.status = AccountStatus.ACTIVE if payload.active else AccountStatus.SUSPENDED
    if not payload.active:
        # Suspendarea trebuie să aibă efect imediat, nu la expirarea sesiunii.
        db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    db.refresh(user)
    log_audit(
        db, actor_id=actor.id, action="staff.activate" if payload.active else "staff.suspend",
        target_type="User", target_id=user.id,
    )
    return _serialize(user)
