from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import Role, Therapy, User

router = APIRouter(prefix="/therapies", tags=["therapies"])


class TherapyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    duration_minutes: int
    price: str
    active: bool

    @classmethod
    def from_orm_obj(cls, t: Therapy) -> "TherapyOut":
        return cls(
            id=t.id,
            name=t.name,
            description=t.description,
            duration_minutes=t.duration_minutes,
            price=str(t.price),
            active=t.active,
        )


class TherapyIn(BaseModel):
    name: str = Field(min_length=2)
    description: str | None = None
    duration_minutes: int = Field(gt=0)
    price: float = Field(ge=0)


# Catalogul de terapii + prețurile — editabil DOAR de ADMIN (nu recepție).
# O terapie e mereu o ședință unică; orice "cumpăr N ședințe" (dintr-o singură
# terapie sau combinate) se face prin /admin/pachete, nu de-aici.


@router.get("")
def list_therapies(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE, Role.CLIENT))
) -> list[TherapyOut]:
    therapies = db.query(Therapy).order_by(Therapy.name.asc()).all()
    return [TherapyOut.from_orm_obj(t) for t in therapies]


@router.post("")
def create_therapy(
    payload: TherapyIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> TherapyOut:
    therapy = Therapy(**payload.model_dump())
    db.add(therapy)
    db.commit()
    db.refresh(therapy)
    log_audit(db, actor_id=actor.id, action="therapy.create", target_type="Therapy", target_id=therapy.id)
    return TherapyOut.from_orm_obj(therapy)


@router.put("/{therapy_id}")
def update_therapy(
    therapy_id: str,
    payload: TherapyIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> TherapyOut:
    therapy = db.get(Therapy, therapy_id)
    if not therapy:
        raise HTTPException(status_code=404, detail="Terapie inexistentă.")
    for key, value in payload.model_dump().items():
        setattr(therapy, key, value)
    db.commit()
    db.refresh(therapy)
    log_audit(db, actor_id=actor.id, action="therapy.update", target_type="Therapy", target_id=therapy_id)
    return TherapyOut.from_orm_obj(therapy)


@router.post("/{therapy_id}/toggle")
def toggle_therapy_active(
    therapy_id: str,
    active: bool,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    therapy = db.get(Therapy, therapy_id)
    if not therapy:
        raise HTTPException(status_code=404, detail="Terapie inexistentă.")
    therapy.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="therapy.activate" if active else "therapy.deactivate",
        target_type="Therapy",
        target_id=therapy_id,
    )
    return {"ok": True}
