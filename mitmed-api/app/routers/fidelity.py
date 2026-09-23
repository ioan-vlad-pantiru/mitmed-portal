from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
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


class FidelityCardTypeOut(BaseModel):
    id: str
    name: str
    therapy_id: str
    therapy_name: str
    active: bool
    tiers: list[TierOut]

    @classmethod
    def from_orm_obj(cls, t: FidelityCardType) -> "FidelityCardTypeOut":
        return cls(
            id=t.id,
            name=t.name,
            therapy_id=t.therapy_id,
            therapy_name=t.therapy.name,
            active=t.active,
            tiers=[TierOut(session_number=tier.session_number, discount_percent=str(tier.discount_percent)) for tier in t.tiers],
        )


class FidelityCardTypeIn(BaseModel):
    name: str = Field(min_length=2)
    therapy_id: str
    # Ex: [{"session_number": 5, "discount_percent": 25}, {"session_number": 6, "discount_percent": 50}]
    # — "a 5-a ședință -25%, a 6-a -50%". Programul se reia ciclic după cea
    # mai mare treaptă. Cel puțin o treaptă e obligatorie — un card fără nicio
    # treaptă n-ar face nimic.
    tiers: list[TierIn] = Field(min_length=1)

    @field_validator("tiers")
    @classmethod
    def _unique_session_numbers(cls, value: list[TierIn]) -> list[TierIn]:
        numbers = [t.session_number for t in value]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Fiecare treaptă trebuie să aibă un număr de ședință diferit.")
        return value


class ClientFidelityCardOut(BaseModel):
    id: str
    card_type_id: str
    card_type_name: str
    therapy_id: str
    therapy_name: str
    tiers: list[TierOut]
    stamps: int
    cycle_length: int
    next_discount_percent: str | None
    discounted_sessions_used: int
    active: bool
    issued_at: datetime


def _serialize_client_card(card: ClientFidelityCard) -> ClientFidelityCardOut:
    discount = next_session_discount_percent(card)
    return ClientFidelityCardOut(
        id=card.id,
        card_type_id=card.card_type_id,
        card_type_name=card.card_type.name,
        therapy_id=card.card_type.therapy_id,
        therapy_name=card.card_type.therapy.name,
        tiers=[TierOut(session_number=t.session_number, discount_percent=str(t.discount_percent)) for t in card.card_type.tiers],
        stamps=card.stamps,
        cycle_length=card.card_type.cycle_length,
        next_discount_percent=str(discount) if discount is not None else None,
        discounted_sessions_used=card.discounted_sessions_used,
        active=card.active,
        issued_at=card.issued_at,
    )


# Catalogul de tipuri de card — editabil DOAR de ADMIN (la fel ca /therapies:
# recepția poate emite/gestiona carduri unui client, dar nu inventa tipuri
# noi sau schimba programul de reduceri).


@router.get("/fidelity-cards/types")
def list_fidelity_card_types(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[FidelityCardTypeOut]:
    types = (
        db.query(FidelityCardType)
        .options(joinedload(FidelityCardType.therapy), joinedload(FidelityCardType.tiers))
        .order_by(FidelityCardType.name.asc())
        .all()
    )
    return [FidelityCardTypeOut.from_orm_obj(t) for t in types]


def _apply_tiers(card_type: FidelityCardType, tiers: list[TierIn]) -> None:
    card_type.tiers = [
        FidelityCardTier(session_number=t.session_number, discount_percent=Decimal(str(t.discount_percent)))
        for t in tiers
    ]


@router.post("/fidelity-cards/types")
def create_fidelity_card_type(
    payload: FidelityCardTypeIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> FidelityCardTypeOut:
    therapy = db.get(Therapy, payload.therapy_id)
    if not therapy:
        raise HTTPException(status_code=422, detail="Terapie invalidă.")
    card_type = FidelityCardType(name=payload.name, therapy_id=payload.therapy_id)
    _apply_tiers(card_type, payload.tiers)
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
    therapy = db.get(Therapy, payload.therapy_id)
    if not therapy:
        raise HTTPException(status_code=422, detail="Terapie invalidă.")
    card_type.name = payload.name
    card_type.therapy_id = payload.therapy_id
    _apply_tiers(card_type, payload.tiers)
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
    """Ștergere reală — permisă doar dacă tipul n-a fost emis niciodată unui
    client. Altfel, dezactivarea (toggle) e calea corectă."""
    card_type = db.get(FidelityCardType, type_id)
    if not card_type:
        raise HTTPException(status_code=404, detail="Tip de card inexistent.")
    in_use = db.query(ClientFidelityCard).filter(ClientFidelityCard.card_type_id == type_id).first()
    if in_use:
        raise HTTPException(
            status_code=409, detail="Acest tip de card a fost deja emis unor clienți — dezactivează-l în loc să-l ștergi."
        )
    db.delete(card_type)
    db.commit()
    log_audit(db, actor_id=actor.id, action="fidelity_card_type.delete", target_type="FidelityCardType", target_id=type_id)
    return {"ok": True}


# Carduri emise unui client anume — gestionate de ADMIN/RECEPTIE, la fel ca
# restul fișei clientului.


class IssueCardIn(BaseModel):
    card_type_id: str


@router.get("/clients/me/fidelity-cards")
def list_own_fidelity_cards(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> list[ClientFidelityCardOut]:
    if not user.client_profile:
        return []
    cards = (
        db.query(ClientFidelityCard)
        .options(
            joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.therapy),
            joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.tiers),
        )
        .filter(ClientFidelityCard.client_id == user.client_profile.id, ClientFidelityCard.active.is_(True))
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return [_serialize_client_card(c) for c in cards]


@router.get("/clients/{client_id}/fidelity-cards")
def list_client_fidelity_cards(
    client_id: str, db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[ClientFidelityCardOut]:
    cards = (
        db.query(ClientFidelityCard)
        .options(
            joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.therapy),
            joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.tiers),
        )
        .filter(ClientFidelityCard.client_id == client_id)
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return [_serialize_client_card(c) for c in cards]


@router.post("/clients/{client_id}/fidelity-cards", status_code=201)
def issue_fidelity_card(
    client_id: str,
    payload: IssueCardIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> ClientFidelityCardOut:
    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client inexistent.")
    card_type = db.get(FidelityCardType, payload.card_type_id)
    if not card_type or not card_type.active:
        raise HTTPException(status_code=422, detail="Tip de card invalid sau dezactivat.")

    card = ClientFidelityCard(client_id=client_id, card_type_id=card_type.id, issued_by_id=actor.id)
    db.add(card)
    db.commit()
    db.refresh(card)
    log_audit(db, actor_id=actor.id, action="fidelity_card.issue", target_type="ClientFidelityCard", target_id=card.id, metadata={"client_id": client_id})
    return _serialize_client_card(card)


@router.post("/clients/{client_id}/fidelity-cards/{card_id}/toggle")
def toggle_client_fidelity_card(
    client_id: str,
    card_id: str,
    active: bool,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
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
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
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
