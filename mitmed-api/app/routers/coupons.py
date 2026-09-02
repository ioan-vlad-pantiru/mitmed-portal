from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import Coupon, CouponType, Role, Therapy, User

router = APIRouter(prefix="/coupons", tags=["coupons"])


class CouponOut(BaseModel):
    id: str
    code: str
    type: CouponType
    value: str
    active: bool
    valid_from: datetime | None
    valid_until: datetime | None
    max_uses: int | None
    uses_count: int
    therapies: list[dict]


class CouponIn(BaseModel):
    code: str = Field(min_length=2)
    type: CouponType
    value: float = Field(ge=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = None
    therapy_ids: list[str] = []


def _serialize(c: Coupon) -> CouponOut:
    return CouponOut(
        id=c.id,
        code=c.code,
        type=c.type,
        value=str(c.value),
        active=c.active,
        valid_from=c.valid_from,
        valid_until=c.valid_until,
        max_uses=c.max_uses,
        uses_count=c.uses_count,
        therapies=[{"id": t.id, "name": t.name} for t in c.therapies],
    )


@router.get("")
def list_coupons(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[CouponOut]:
    coupons = (
        db.query(Coupon).options(joinedload(Coupon.therapies)).order_by(Coupon.created_at.desc()).all()
    )
    return [_serialize(c) for c in coupons]


@router.post("")
def create_coupon(
    payload: CouponIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> CouponOut:
    code = payload.code.strip().upper()
    existing = db.query(Coupon).filter(Coupon.code == code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Există deja un cupon cu acest cod.")

    therapies = db.query(Therapy).filter(Therapy.id.in_(payload.therapy_ids)).all() if payload.therapy_ids else []

    coupon = Coupon(
        code=code,
        type=payload.type,
        value=payload.value,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        max_uses=payload.max_uses,
        therapies=therapies,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    log_audit(db, actor_id=actor.id, action="coupon.create", target_type="Coupon", target_id=coupon.id)
    return _serialize(coupon)


@router.put("/{coupon_id}")
def update_coupon(
    coupon_id: str,
    payload: CouponIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> CouponOut:
    coupon = db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupon inexistent.")

    code = payload.code.strip().upper()
    existing = db.query(Coupon).filter(Coupon.code == code, Coupon.id != coupon_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Există deja un alt cupon cu acest cod.")

    therapies = db.query(Therapy).filter(Therapy.id.in_(payload.therapy_ids)).all() if payload.therapy_ids else []

    coupon.code = code
    coupon.type = payload.type
    coupon.value = payload.value
    coupon.valid_from = payload.valid_from
    coupon.valid_until = payload.valid_until
    coupon.max_uses = payload.max_uses
    coupon.therapies = therapies

    db.commit()
    db.refresh(coupon)
    log_audit(db, actor_id=actor.id, action="coupon.update", target_type="Coupon", target_id=coupon_id)
    return _serialize(coupon)


@router.post("/{coupon_id}/toggle")
def toggle_coupon_active(
    coupon_id: str, active: bool, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    coupon = db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupon inexistent.")
    coupon.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="coupon.activate" if active else "coupon.deactivate",
        target_type="Coupon",
        target_id=coupon_id,
    )
    return {"ok": True}
