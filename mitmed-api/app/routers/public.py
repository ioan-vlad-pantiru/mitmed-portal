"""Endpoint-uri PUBLICE, fără autentificare — folosite de widget-ul de
programare de pe site-ul de prezentare (mitmed.ro, export static). Nu se
creează niciodată cont/programare automat dintr-o cerere publică — recepția
confirmă manual, ca să nu putem fi umpluți de conturi false."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import BookingRequestStatus, PackageItem, PublicBookingRequest, Role, Therapy, TherapyPackage, User
from app.rate_limit import limiter


def client_ip(request: Request) -> str:
    """Cererile publice ajung aici prin proxy-ul portalului (API-ul nu e expus
    public în producție), deci adresa directă e mereu containerul portalului.
    Portalul transmite IP-ul real al vizitatorului în X-Forwarded-For (primit
    de la Caddy), iar limita per-IP trebuie să folosească acel IP — altfel
    toți vizitatorii ar împărți aceeași limită."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

router = APIRouter(prefix="/public", tags=["public"])


class BookingRequestIn(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    email: str | None = None
    therapy_id: str | None = None
    preferred_starts_at: datetime | None = None
    message: str | None = None


class PublicTherapyOut(BaseModel):
    id: str
    name: str
    description: str | None
    duration_minutes: int
    price: str
    is_consultation: bool


class PublicPackageItemOut(BaseModel):
    therapy_name: str
    sessions_included: int


class PublicPackageOut(BaseModel):
    id: str
    name: str
    list_price: str
    price: str
    items: list[PublicPackageItemOut]


class BookingRequestOut(BaseModel):
    id: str
    full_name: str
    phone: str
    email: str | None
    therapy_name: str | None
    preferred_starts_at: datetime | None
    message: str | None
    status: BookingRequestStatus
    created_at: datetime


# Doar terapiile active, cu preț — alimentează lista „Ce serviciu te
# interesează?" din formularul de programare fără cont și lista de tarife de pe
# site (PayU cere ca prețurile să fie vizibile public, înainte de cont).
@router.get("/therapies")
def list_public_therapies(db: DBSession = Depends(get_db)) -> list[PublicTherapyOut]:
    therapies = (
        db.query(Therapy)
        .filter(Therapy.active.is_(True))
        .order_by(Therapy.is_consultation.desc(), Therapy.name)
        .all()
    )
    return [
        PublicTherapyOut(
            id=t.id,
            name=t.name,
            description=t.description,
            duration_minutes=t.duration_minutes,
            price=f"{float(t.price):.2f}",
            is_consultation=t.is_consultation,
        )
        for t in therapies
    ]


# Pachetele active, cu prețul final — pentru lista de tarife de pe site.
@router.get("/packages")
def list_public_packages(db: DBSession = Depends(get_db)) -> list[PublicPackageOut]:
    packages = (
        db.query(TherapyPackage)
        .options(joinedload(TherapyPackage.items).joinedload(PackageItem.therapy))
        .filter(TherapyPackage.active.is_(True))
        .order_by(TherapyPackage.name.asc())
        .all()
    )
    return [
        PublicPackageOut(
            id=p.id,
            name=p.name,
            list_price=f"{p.list_price:.2f}",
            price=f"{p.price:.2f}",
            items=[
                PublicPackageItemOut(therapy_name=i.therapy.name, sessions_included=i.sessions_included)
                for i in p.items
            ],
        )
        for p in packages
    ]


# Fără autentificare — accesibilă de pe alt domeniu (site-ul de prezentare),
# de-asta CORS-ul din app/config.py trebuie să includă și acel domeniu.
@router.post("/booking-requests", status_code=201)
@limiter.limit("10/hour", key_func=client_ip)
def create_booking_request(request: Request, payload: BookingRequestIn, db: DBSession = Depends(get_db)) -> dict:
    if payload.therapy_id:
        therapy = db.get(Therapy, payload.therapy_id)
        if not therapy:
            raise HTTPException(status_code=422, detail="Terapie invalidă.")

    request = PublicBookingRequest(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        therapy_id=payload.therapy_id,
        preferred_starts_at=payload.preferred_starts_at,
        message=payload.message,
    )
    db.add(request)
    db.commit()
    return {"ok": True, "message": "Cererea a fost trimisă. Te contactăm noi pentru confirmare."}


@router.get("/booking-requests")
def list_booking_requests(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[BookingRequestOut]:
    requests = (
        db.query(PublicBookingRequest)
        .options(joinedload(PublicBookingRequest.therapy))
        .order_by(PublicBookingRequest.created_at.desc())
        .all()
    )
    return [
        BookingRequestOut(
            id=r.id,
            full_name=r.full_name,
            phone=r.phone,
            email=r.email,
            therapy_name=r.therapy.name if r.therapy else None,
            preferred_starts_at=r.preferred_starts_at,
            message=r.message,
            status=r.status,
            created_at=r.created_at,
        )
        for r in requests
    ]


@router.post("/booking-requests/{request_id}/reject")
def reject_booking_request(
    request_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    request = db.get(PublicBookingRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Cerere inexistentă.")
    request.status = BookingRequestStatus.RESPINS
    db.commit()
    log_audit(db, actor_id=actor.id, action="booking_request.reject", target_type="PublicBookingRequest", target_id=request_id)
    return {"ok": True}


@router.post("/booking-requests/{request_id}/mark-confirmed")
def mark_booking_request_confirmed(
    request_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    """Marchează cererea ca rezolvată, DUPĂ ce admin/recepția a creat manual
    contul + programarea din pagina de client (nu automatizăm crearea contului
    dintr-o sursă publică nesigură)."""
    request = db.get(PublicBookingRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Cerere inexistentă.")
    request.status = BookingRequestStatus.CONFIRMAT
    db.commit()
    log_audit(db, actor_id=actor.id, action="booking_request.confirm", target_type="PublicBookingRequest", target_id=request_id)
    return {"ok": True}
