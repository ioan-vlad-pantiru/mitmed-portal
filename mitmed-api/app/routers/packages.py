from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import PackageItem, Payment, Role, Therapy, TherapyPackage, User

router = APIRouter(prefix="/packages", tags=["packages"])


class PackageItemOut(BaseModel):
    therapy_id: str
    therapy_name: str
    sessions_included: int


class PackageOut(BaseModel):
    id: str
    name: str
    discount_percent: str
    list_price: str
    price: str
    active: bool
    items: list[PackageItemOut]


class PackageItemIn(BaseModel):
    therapy_id: str
    sessions_included: int = Field(ge=1)


class PackageIn(BaseModel):
    name: str = Field(min_length=2)
    discount_percent: float = Field(ge=0, le=100)
    items: list[PackageItemIn] = Field(min_length=1)


def _serialize(p: TherapyPackage) -> PackageOut:
    return PackageOut(
        id=p.id,
        name=p.name,
        discount_percent=str(p.discount_percent),
        list_price=str(p.list_price),
        price=str(p.price),
        active=p.active,
        items=[
            PackageItemOut(therapy_id=i.therapy_id, therapy_name=i.therapy.name, sessions_included=i.sessions_included)
            for i in p.items
        ],
    )


def _validate_items(db: DBSession, items: list[PackageItemIn]) -> None:
    therapy_ids = {i.therapy_id for i in items}
    if len(therapy_ids) != len(items):
        raise HTTPException(status_code=422, detail="Aceeași terapie nu poate apărea de două ori în pachet.")
    found = db.query(Therapy.id).filter(Therapy.id.in_(therapy_ids)).count()
    if found != len(therapy_ids):
        raise HTTPException(status_code=422, detail="O terapie din pachet nu există.")


@router.get("")
def list_packages(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[PackageOut]:
    packages = (
        db.query(TherapyPackage)
        .options(joinedload(TherapyPackage.items).joinedload(PackageItem.therapy))
        .order_by(TherapyPackage.name.asc())
        .all()
    )
    return [_serialize(p) for p in packages]


@router.post("")
def create_package(
    payload: PackageIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> PackageOut:
    _validate_items(db, payload.items)

    package = TherapyPackage(name=payload.name, discount_percent=payload.discount_percent)
    package.items = [
        PackageItem(therapy_id=i.therapy_id, sessions_included=i.sessions_included) for i in payload.items
    ]
    db.add(package)
    db.commit()
    db.refresh(package)
    log_audit(db, actor_id=actor.id, action="package.create", target_type="TherapyPackage", target_id=package.id)
    return _serialize(package)


@router.put("/{package_id}")
def update_package(
    package_id: str,
    payload: PackageIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> PackageOut:
    package = db.get(TherapyPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Pachet inexistent.")
    _validate_items(db, payload.items)

    package.name = payload.name
    package.discount_percent = payload.discount_percent
    # Rescrie complet lista de terapii incluse — mai simplu și mai puțin
    # predispus la erori decât un diff linie-cu-linie pentru un pachet cu
    # câteva rânduri. Nu afectează pachetele deja cumpărate (Payment-urile
    # existente și-au copiat deja sessions_included la momentul cumpărării).
    package.items = [
        PackageItem(therapy_id=i.therapy_id, sessions_included=i.sessions_included) for i in payload.items
    ]
    db.commit()
    db.refresh(package)
    log_audit(db, actor_id=actor.id, action="package.update", target_type="TherapyPackage", target_id=package_id)
    return _serialize(package)


@router.post("/{package_id}/toggle")
def toggle_package_active(
    package_id: str,
    active: bool,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    package = db.get(TherapyPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Pachet inexistent.")
    package.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="package.activate" if active else "package.deactivate",
        target_type="TherapyPackage",
        target_id=package_id,
    )
    return {"ok": True}


@router.delete("/{package_id}")
def delete_package(
    package_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Ștergere reală — permisă doar dacă pachetul n-a fost vândut
    niciodată. Altfel, dezactivarea e calea corectă — șterge-l ar strica
    achizițiile deja înregistrate ale clienților."""
    package = db.get(TherapyPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Pachet inexistent.")

    if db.query(Payment).filter(Payment.package_id == package_id).first():
        raise HTTPException(
            status_code=409, detail="Pachetul a fost deja vândut — dezactivează-l în loc să-l ștergi."
        )

    db.delete(package)  # PackageItem-urile lui se șterg automat (cascade).
    db.commit()
    log_audit(db, actor_id=actor.id, action="package.delete", target_type="TherapyPackage", target_id=package_id)
    return {"ok": True}
