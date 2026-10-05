from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import Appointment, MedicalRecord, PackageItem, Payment, Role, Therapy, User, medical_record_therapies

router = APIRouter(prefix="/therapies", tags=["therapies"])


class TherapyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    duration_minutes: int
    price: str
    active: bool
    is_consultation: bool

    @classmethod
    def from_orm_obj(cls, t: Therapy) -> "TherapyOut":
        return cls(
            id=t.id,
            name=t.name,
            description=t.description,
            duration_minutes=t.duration_minutes,
            price=str(t.price),
            active=t.active,
            is_consultation=t.is_consultation,
        )


class TherapyIn(BaseModel):
    name: str = Field(min_length=2)
    description: str | None = None
    duration_minutes: int = Field(gt=0)
    price: float = Field(ge=0)
    is_consultation: bool = False


# Catalogul de terapii + prețurile — editabil DOAR de ADMIN (nu recepție).
# O terapie e mereu o ședință unică; orice "cumpăr N ședințe" (dintr-o singură
# terapie sau combinate) se face prin /admin/pachete, nu de-aici.


@router.get("")
def list_therapies(
    db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE, Role.CLIENT))
) -> list[TherapyOut]:
    therapies = db.query(Therapy).order_by(Therapy.name.asc()).all()
    if actor.role == Role.CLIENT:
        # Un client nou nu are nicio terapie deblocată — poate rezerva singur
        # doar consultația (sau alte terapii marcate `is_consultation`), până
        # când medicul îi deblochează manual restul (vezi
        # clients.update_client_unlocked_therapies), de obicei după ce l-a
        # văzut la consultație.
        client = actor.client_profile
        unlocked_ids = {t.id for t in client.unlocked_therapies} if client else set()
        therapies = [t for t in therapies if t.is_consultation or t.id in unlocked_ids]
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


@router.delete("/{therapy_id}")
def delete_therapy(
    therapy_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Ștergere reală — permisă doar dacă terapia n-a fost folosită
    niciodată (nicio programare, plată, fișă medicală sau pachet care o
    include). Altfel, dezactivarea (toggle) e calea corectă — șterge istoric
    real ar strica programări/plăți/fișe deja existente."""
    therapy = db.get(Therapy, therapy_id)
    if not therapy:
        raise HTTPException(status_code=404, detail="Terapie inexistentă.")

    in_use = (
        db.query(Appointment).filter(Appointment.therapy_id == therapy_id).first()
        or db.query(Payment).filter(Payment.therapy_id == therapy_id).first()
        or db.query(MedicalRecord).filter(MedicalRecord.therapy_id == therapy_id).first()
        or db.query(medical_record_therapies).filter(medical_record_therapies.c.therapy_id == therapy_id).first()
        or db.query(PackageItem).filter(PackageItem.therapy_id == therapy_id).first()
    )
    if in_use:
        raise HTTPException(
            status_code=409,
            detail="Terapia este deja folosită (programări, plăți, fișe sau pachete) — dezactiveaz-o în loc s-o ștergi.",
        )

    db.delete(therapy)
    db.commit()
    log_audit(db, actor_id=actor.id, action="therapy.delete", target_type="Therapy", target_id=therapy_id)
    return {"ok": True}
