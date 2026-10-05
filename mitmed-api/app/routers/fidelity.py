from collections import Counter
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import (
    ClientFidelityCard,
    ClientProfile,
    FidelityCardTier,
    FidelityCardType,
    Payment,
    Role,
    Therapy,
    User,
)
from app.services.fidelity import next_session_discount_percent

router = APIRouter(tags=["fidelity"])


class TierOut(BaseModel):
    session_number: int
    discount_percent: str


class TierIn(BaseModel):
    session_number: int = Field(gt=0)
    discount_percent: float = Field(gt=0, le=100)


class CardTherapyOut(BaseModel):
    therapy_id: str
    therapy_name: str


def _tiers_out(tiers: list[FidelityCardTier]) -> list[TierOut]:
    return [TierOut(session_number=t.session_number, discount_percent=str(t.discount_percent)) for t in tiers]


def _therapies_out(therapies: list[Therapy]) -> list[CardTherapyOut]:
    return [CardTherapyOut(therapy_id=t.id, therapy_name=t.name) for t in therapies]


class FidelityCardTypeOut(BaseModel):
    id: str
    name: str
    active: bool
    therapies: list[CardTherapyOut]
    tiers: list[TierOut]

    @classmethod
    def from_orm_obj(cls, t: FidelityCardType) -> "FidelityCardTypeOut":
        return cls(
            id=t.id,
            name=t.name,
            active=t.active,
            therapies=_therapies_out(t.sorted_therapies),
            tiers=_tiers_out(t.tiers),
        )


class FidelityCardTypeIn(BaseModel):
    name: str = Field(min_length=2)
    # Terapiile ale căror ședințe plătite se adună pe contorul cardului.
    therapy_ids: list[str] = Field(min_length=1)
    # Ex: [{"session_number": 5, "discount_percent": 25}, {"session_number": 10, "discount_percent": 50}]
    # — "a 5-a ședință -25%, a 10-a -50%", din oricare terapie a cardului.
    # Programul se reia ciclic după cea mai mare treaptă. Cel puțin o treaptă
    # e obligatorie — un card fără nicio treaptă n-ar face nimic.
    tiers: list[TierIn] = Field(min_length=1)

    @field_validator("therapy_ids")
    @classmethod
    def _unique_therapies(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Fiecare terapie poate apărea o singură dată pe card.")
        return value

    @field_validator("tiers")
    @classmethod
    def _unique_session_numbers(cls, value: list[TierIn]) -> list[TierIn]:
        numbers = [t.session_number for t in value]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Fiecare treaptă trebuie să aibă un număr de ședință diferit.")
        return value


class NextRewardOut(BaseModel):
    session_number: int
    discount_percent: str
    # 0 = chiar următoarea ședință plătită primește reducerea.
    sessions_left: int


class CycleSessionsOut(BaseModel):
    therapy_name: str
    sessions: int


class ClientFidelityCardOut(BaseModel):
    id: str
    card_type_id: str
    card_type_name: str
    # Terapiile cardului activate pentru acest client.
    therapies: list[CardTherapyOut]
    tiers: list[TierOut]
    stamps: int
    cycle_length: int
    # Din ce terapii provin ședințele din ciclul curent (ex. 2 masaj, 1 kineto).
    cycle_breakdown: list[CycleSessionsOut]
    next_discount_percent: str | None
    next_reward: NextRewardOut | None
    discounted_sessions_used: int
    active: bool
    issued_at: datetime


class IssuedFidelityCardOut(ClientFidelityCardOut):
    client_id: str
    client_name: str


def _cycle_breakdown(db: DBSession, card: ClientFidelityCard) -> list[CycleSessionsOut]:
    """Terapiile ultimelor `stamps` ședințe ștampilate pe card — adică cele
    din ciclul curent."""
    if card.stamps <= 0:
        return []
    rows = (
        db.query(Therapy.name)
        .join(Payment, Payment.therapy_id == Therapy.id)
        .filter(Payment.fidelity_stamped_card_id == card.id)
        .order_by(func.coalesce(Payment.paid_at, Payment.created_at).desc())
        .limit(card.stamps)
        .all()
    )
    counts = Counter(name for (name,) in rows)
    return [CycleSessionsOut(therapy_name=name, sessions=n) for name, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def _serialize_client_card(db: DBSession, card: ClientFidelityCard) -> ClientFidelityCardOut:
    card_type = card.card_type
    position = card.stamps + 1
    discount = next_session_discount_percent(card)
    # Următoarea treaptă din ciclul curent — există mereu, fiindcă ciclul se
    # încheie exact la cea mai mare treaptă.
    upcoming = next((t for t in card_type.tiers if t.session_number >= position), None)
    enabled = set(card.therapy_ids)
    return ClientFidelityCardOut(
        id=card.id,
        card_type_id=card.card_type_id,
        card_type_name=card_type.name,
        therapies=_therapies_out([t for t in card_type.sorted_therapies if t.id in enabled]),
        tiers=_tiers_out(card_type.tiers),
        stamps=card.stamps,
        cycle_length=card_type.cycle_length,
        cycle_breakdown=_cycle_breakdown(db, card),
        next_discount_percent=str(discount) if discount is not None else None,
        next_reward=NextRewardOut(
            session_number=upcoming.session_number,
            discount_percent=str(upcoming.discount_percent),
            sessions_left=upcoming.session_number - position,
        )
        if upcoming
        else None,
        discounted_sessions_used=card.discounted_sessions_used,
        active=card.active,
        issued_at=card.issued_at,
    )


def _card_query(db: DBSession):
    return db.query(ClientFidelityCard).options(
        joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.tiers),
        joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.therapies),
        joinedload(ClientFidelityCard.therapies),
    )


# Catalogul de tipuri de card — editabil DOAR de ADMIN (la fel ca /therapies:
# recepția poate vedea cardurile unui client, dar nu inventa tipuri noi sau
# schimba programul de reduceri).


@router.get("/fidelity-cards/types")
def list_fidelity_card_types(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[FidelityCardTypeOut]:
    types = (
        db.query(FidelityCardType)
        .options(joinedload(FidelityCardType.tiers), joinedload(FidelityCardType.therapies))
        .order_by(FidelityCardType.name.asc())
        .all()
    )
    return [FidelityCardTypeOut.from_orm_obj(t) for t in types]


def _apply_card_type(db: DBSession, card_type: FidelityCardType, payload: FidelityCardTypeIn) -> None:
    therapies = (
        db.query(Therapy).filter(Therapy.id.in_(payload.therapy_ids), Therapy.archived_at.is_(None)).all()
    )
    if len(therapies) != len(payload.therapy_ids):
        raise HTTPException(status_code=422, detail="Terapie invalidă.")
    card_type.name = payload.name
    card_type.therapies = therapies
    # La flush, SQLAlchemy inserează rândurile noi ÎNAINTE să le șteargă pe
    # cele orfane — fără golirea explicită, o treaptă păstrată neschimbată
    # s-ar lovi de indexul unic (card, ședință).
    if card_type.id and card_type.tiers:
        card_type.tiers = []
        db.flush()
    card_type.tiers = [
        FidelityCardTier(session_number=t.session_number, discount_percent=Decimal(str(t.discount_percent)))
        for t in payload.tiers
    ]


@router.post("/fidelity-cards/types")
def create_fidelity_card_type(
    payload: FidelityCardTypeIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> FidelityCardTypeOut:
    card_type = FidelityCardType(name=payload.name)
    _apply_card_type(db, card_type, payload)
    db.add(card_type)
    db.commit()
    db.refresh(card_type)
    log_audit(db, actor_id=actor.id, action="fidelity_card_type.create", target_type="FidelityCardType", target_id=card_type.id)
    return FidelityCardTypeOut.from_orm_obj(card_type)


@router.put("/fidelity-cards/types/{type_id}")
def update_fidelity_card_type(
    type_id: str,
    payload: FidelityCardTypeIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> FidelityCardTypeOut:
    card_type = db.get(FidelityCardType, type_id)
    if not card_type:
        raise HTTPException(status_code=404, detail="Tip de card inexistent.")
    _apply_card_type(db, card_type, payload)
    db.commit()
    db.refresh(card_type)
    log_audit(db, actor_id=actor.id, action="fidelity_card_type.update", target_type="FidelityCardType", target_id=type_id)
    return FidelityCardTypeOut.from_orm_obj(card_type)


@router.post("/fidelity-cards/types/{type_id}/toggle")
def toggle_fidelity_card_type(
    type_id: str, active: bool, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    card_type = db.get(FidelityCardType, type_id)
    if not card_type:
        raise HTTPException(status_code=404, detail="Tip de card inexistent.")
    card_type.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="fidelity_card_type.activate" if active else "fidelity_card_type.deactivate",
        target_type="FidelityCardType",
        target_id=type_id,
    )
    return {"ok": True}


@router.delete("/fidelity-cards/types/{type_id}")
def delete_fidelity_card_type(
    type_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    """Ștergere reală — blocată doar cât timp tipul e atribuit ACTIV unui
    client (adminul trebuie întâi să-i revoce cardul). Cardurile revocate din
    acest tip se șterg odată cu el; plățile care primiseră reducere prin ele
    își păstrează prețul și reducerea, doar legătura spre card dispare."""
    card_type = db.get(FidelityCardType, type_id)
    if not card_type:
        raise HTTPException(status_code=404, detail="Tip de card inexistent.")
    cards = db.query(ClientFidelityCard).filter(ClientFidelityCard.card_type_id == type_id).all()
    holders = sorted({c.client.full_name for c in cards if c.active})
    if holders:
        raise HTTPException(
            status_code=409,
            detail=f"Cardul e încă atribuit la: {', '.join(holders)}. Revocă-l din fișa clientului sau dezactivează "
            "tipul de card.",
        )
    card_ids = [c.id for c in cards]
    if card_ids:
        db.query(Payment).filter(Payment.fidelity_card_id.in_(card_ids)).update(
            {Payment.fidelity_card_id: None}, synchronize_session=False
        )
        db.query(Payment).filter(Payment.fidelity_stamped_card_id.in_(card_ids)).update(
            {Payment.fidelity_stamped_card_id: None}, synchronize_session=False
        )
        for card in cards:
            db.delete(card)
    db.delete(card_type)
    db.commit()
    log_audit(db, actor_id=actor.id, action="fidelity_card_type.delete", target_type="FidelityCardType", target_id=type_id)
    return {"ok": True}


# Carduri emise unui client anume — atribuite, revocate și configurate DOAR de
# ADMIN; recepția le poate doar vedea (cu progresul), pe fișa clientului.


class IssueCardIn(BaseModel):
    card_type_id: str
    # Terapiile tipului de card care se aplică acestui client. Omis = toate.
    therapy_ids: list[str] | None = None


class CardTherapiesIn(BaseModel):
    therapy_ids: list[str] = Field(min_length=1)


def _set_card_therapies(db: DBSession, card: ClientFidelityCard, card_type: FidelityCardType, therapy_ids: list[str]) -> None:
    """Activează exact terapiile date pe cardul clientului. Contorul cardului
    e comun, deci schimbarea terapiilor nu-i atinge progresul."""
    allowed = {t.id for t in card_type.therapies}
    wanted = set(therapy_ids)
    if not wanted:
        raise HTTPException(status_code=422, detail="Alege cel puțin o terapie pentru card.")
    if not wanted <= allowed:
        raise HTTPException(status_code=422, detail="O terapie aleasă nu face parte din acest tip de card.")
    card.therapies = [t for t in card_type.therapies if t.id in wanted]


@router.get("/fidelity-cards/issued")
def list_issued_fidelity_cards(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[IssuedFidelityCardOut]:
    """Toate cardurile active, cu progresul pe fiecare terapie — vederea de
    ansamblu din /admin/fidelitate."""
    cards = (
        _card_query(db)
        .options(joinedload(ClientFidelityCard.client))
        .filter(ClientFidelityCard.active.is_(True))
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return [
        IssuedFidelityCardOut(
            **_serialize_client_card(db, c).model_dump(), client_id=c.client_id, client_name=c.client.full_name
        )
        for c in cards
    ]


@router.get("/clients/me/fidelity-cards")
def list_own_fidelity_cards(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> list[ClientFidelityCardOut]:
    if not user.client_profile:
        return []
    cards = (
        _card_query(db)
        .filter(ClientFidelityCard.client_id == user.client_profile.id, ClientFidelityCard.active.is_(True))
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return [_serialize_client_card(db, c) for c in cards]


@router.get("/clients/{client_id}/fidelity-cards")
def list_client_fidelity_cards(
    client_id: str, db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[ClientFidelityCardOut]:
    cards = (
        _card_query(db)
        .filter(ClientFidelityCard.client_id == client_id)
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return [_serialize_client_card(db, c) for c in cards]


@router.post("/clients/{client_id}/fidelity-cards", status_code=201)
def issue_fidelity_card(
    client_id: str,
    payload: IssueCardIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> ClientFidelityCardOut:
    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")
    card_type = db.get(FidelityCardType, payload.card_type_id)
    if not card_type or not card_type.active:
        raise HTTPException(status_code=422, detail="Tip de card invalid sau dezactivat.")

    card = ClientFidelityCard(client_id=client_id, card_type_id=card_type.id, issued_by_id=actor.id)
    _set_card_therapies(
        db,
        card,
        card_type,
        payload.therapy_ids if payload.therapy_ids is not None else [t.id for t in card_type.therapies],
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    log_audit(db, actor_id=actor.id, action="fidelity_card.issue", target_type="ClientFidelityCard", target_id=card.id, metadata={"client_id": client_id})
    return _serialize_client_card(db, card)


@router.put("/clients/{client_id}/fidelity-cards/{card_id}/therapies")
def update_client_card_therapies(
    client_id: str,
    card_id: str,
    payload: CardTherapiesIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> ClientFidelityCardOut:
    card = db.get(ClientFidelityCard, card_id)
    if not card or card.client_id != client_id:
        raise HTTPException(status_code=404, detail="Card inexistent.")
    _set_card_therapies(db, card, card.card_type, payload.therapy_ids)
    db.commit()
    db.refresh(card)
    log_audit(
        db,
        actor_id=actor.id,
        action="fidelity_card.therapies",
        target_type="ClientFidelityCard",
        target_id=card_id,
        metadata={"therapy_ids": payload.therapy_ids},
    )
    return _serialize_client_card(db, card)


@router.post("/clients/{client_id}/fidelity-cards/{card_id}/toggle")
def toggle_client_fidelity_card(
    client_id: str,
    card_id: str,
    active: bool,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    card = db.get(ClientFidelityCard, card_id)
    if not card or card.client_id != client_id:
        raise HTTPException(status_code=404, detail="Card inexistent.")
    card.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="fidelity_card.activate" if active else "fidelity_card.revoke",
        target_type="ClientFidelityCard",
        target_id=card_id,
    )
    return {"ok": True}


@router.delete("/clients/{client_id}/fidelity-cards/{card_id}")
def delete_client_fidelity_card(
    client_id: str,
    card_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Ștergere reală — permisă doar dacă niciun Payment nu s-a legat deja de
    acest card (o reducere deja acordată trebuie să rămână trasabilă în
    istoricul plăților). Altfel, revocarea (toggle) e calea corectă."""
    card = db.get(ClientFidelityCard, card_id)
    if not card or card.client_id != client_id:
        raise HTTPException(status_code=404, detail="Card inexistent.")
    in_use = db.query(Payment).filter(Payment.fidelity_card_id == card_id).first()
    if in_use:
        raise HTTPException(status_code=409, detail="Acest card a acordat deja o reducere — revocă-l în loc să-l ștergi.")
    db.delete(card)
    db.commit()
    log_audit(db, actor_id=actor.id, action="fidelity_card.delete", target_type="ClientFidelityCard", target_id=card_id)
    return {"ok": True}
