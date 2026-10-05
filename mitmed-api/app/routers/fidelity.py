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
    ClientFidelityCardProgress,
    ClientProfile,
    FidelityCardTier,
    FidelityCardType,
    Payment,
    Role,
    Therapy,
    User,
)
from app.services.fidelity import card_stamps, next_session_discount_percent

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
    tiers: list[TierOut]


class CardTherapyIn(BaseModel):
    therapy_id: str
    # Ex: [{"session_number": 5, "discount_percent": 25}, {"session_number": 6, "discount_percent": 50}]
    # — "a 5-a ședință -25%, a 6-a -50%". Programul terapiei se reia ciclic
    # după cea mai mare treaptă a ei. Cel puțin o treaptă e obligatorie — o
    # terapie fără nicio treaptă n-ar face nimic pe card.
    tiers: list[TierIn] = Field(min_length=1)

    @field_validator("tiers")
    @classmethod
    def _unique_session_numbers(cls, value: list[TierIn]) -> list[TierIn]:
        numbers = [t.session_number for t in value]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Fiecare treaptă a unei terapii trebuie să aibă un număr de ședință diferit.")
        return value


def _tiers_out(tiers: list[FidelityCardTier]) -> list[TierOut]:
    return [TierOut(session_number=t.session_number, discount_percent=str(t.discount_percent)) for t in tiers]


def _therapy_name(card_type: FidelityCardType, therapy_id: str) -> str:
    return next(t.therapy.name for t in card_type.tiers if t.therapy_id == therapy_id)


class FidelityCardTypeOut(BaseModel):
    id: str
    name: str
    active: bool
    therapies: list[CardTherapyOut]

    @classmethod
    def from_orm_obj(cls, t: FidelityCardType) -> "FidelityCardTypeOut":
        return cls(
            id=t.id,
            name=t.name,
            active=t.active,
            therapies=[
                CardTherapyOut(therapy_id=tid, therapy_name=_therapy_name(t, tid), tiers=_tiers_out(t.tiers_for(tid)))
                for tid in t.therapy_ids
            ],
        )


class FidelityCardTypeIn(BaseModel):
    name: str = Field(min_length=2)
    therapies: list[CardTherapyIn] = Field(min_length=1)

    @field_validator("therapies")
    @classmethod
    def _unique_therapies(cls, value: list[CardTherapyIn]) -> list[CardTherapyIn]:
        ids = [t.therapy_id for t in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Fiecare terapie poate apărea o singură dată pe card.")
        return value


class NextRewardOut(BaseModel):
    session_number: int
    discount_percent: str
    # 0 = chiar următoarea ședință plătită primește reducerea.
    sessions_left: int


class CardTherapyProgressOut(CardTherapyOut):
    stamps: int
    cycle_length: int
    next_discount_percent: str | None
    next_reward: NextRewardOut | None
    discounted_sessions_used: int


class ClientFidelityCardOut(BaseModel):
    id: str
    card_type_id: str
    card_type_name: str
    therapies: list[CardTherapyProgressOut]
    active: bool
    issued_at: datetime


class IssuedFidelityCardOut(ClientFidelityCardOut):
    client_id: str
    client_name: str


def _therapy_progress(card: ClientFidelityCard, therapy_id: str) -> CardTherapyProgressOut:
    card_type = card.card_type
    tiers = card_type.tiers_for(therapy_id)
    stamps = card_stamps(card, therapy_id)
    position = stamps + 1
    discount = next_session_discount_percent(card, therapy_id)
    # Următoarea treaptă din ciclul curent — există mereu, fiindcă ciclul se
    # încheie exact la cea mai mare treaptă.
    upcoming = next((t for t in tiers if t.session_number >= position), None)
    progress = card.progress_for(therapy_id)
    return CardTherapyProgressOut(
        therapy_id=therapy_id,
        therapy_name=_therapy_name(card_type, therapy_id),
        tiers=_tiers_out(tiers),
        stamps=stamps,
        cycle_length=card_type.cycle_length(therapy_id),
        next_discount_percent=str(discount) if discount is not None else None,
        next_reward=NextRewardOut(
            session_number=upcoming.session_number,
            discount_percent=str(upcoming.discount_percent),
            sessions_left=upcoming.session_number - position,
        )
        if upcoming
        else None,
        discounted_sessions_used=progress.discounted_sessions_used if progress else 0,
    )


def _serialize_client_card(card: ClientFidelityCard) -> ClientFidelityCardOut:
    return ClientFidelityCardOut(
        id=card.id,
        card_type_id=card.card_type_id,
        card_type_name=card.card_type.name,
        therapies=[_therapy_progress(card, tid) for tid in card.therapy_ids],
        active=card.active,
        issued_at=card.issued_at,
    )


def _card_query(db: DBSession):
    return db.query(ClientFidelityCard).options(
        joinedload(ClientFidelityCard.card_type).joinedload(FidelityCardType.tiers).joinedload(FidelityCardTier.therapy),
        joinedload(ClientFidelityCard.progress),
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
        .options(joinedload(FidelityCardType.tiers).joinedload(FidelityCardTier.therapy))
        .order_by(FidelityCardType.name.asc())
        .all()
    )
    return [FidelityCardTypeOut.from_orm_obj(t) for t in types]


def _apply_tiers(db: DBSession, card_type: FidelityCardType, therapies: list[CardTherapyIn]) -> None:
    therapy_ids = [t.therapy_id for t in therapies]
    found = db.query(Therapy.id).filter(Therapy.id.in_(therapy_ids)).count()
    if found != len(therapy_ids):
        raise HTTPException(status_code=422, detail="Terapie invalidă.")
    # La flush, SQLAlchemy inserează rândurile noi ÎNAINTE să le șteargă pe
    # cele orfane — fără golirea explicită, o treaptă păstrată neschimbată
    # s-ar lovi de indexul unic (card, terapie, ședință).
    if card_type.id and card_type.tiers:
        card_type.tiers = []
        db.flush()
    card_type.tiers = [
        FidelityCardTier(
            therapy_id=therapy.therapy_id,
            session_number=tier.session_number,
            discount_percent=Decimal(str(tier.discount_percent)),
        )
        for therapy in therapies
        for tier in therapy.tiers
    ]


@router.post("/fidelity-cards/types")
def create_fidelity_card_type(
    payload: FidelityCardTypeIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> FidelityCardTypeOut:
    card_type = FidelityCardType(name=payload.name)
    _apply_tiers(db, card_type, payload.therapies)
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
    card_type.name = payload.name
    _apply_tiers(db, card_type, payload.therapies)
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


# Carduri emise unui client anume — atribuite, revocate și configurate DOAR de
# ADMIN; recepția le poate doar vedea (cu progresul), pe fișa clientului.


class IssueCardIn(BaseModel):
    card_type_id: str
    # Terapiile tipului de card care se aplică acestui client. Omis = toate.
    therapy_ids: list[str] | None = None


class CardTherapiesIn(BaseModel):
    therapy_ids: list[str] = Field(min_length=1)


def _set_card_therapies(card: ClientFidelityCard, card_type: FidelityCardType, therapy_ids: list[str]) -> None:
    """Activează exact terapiile date pe cardul clientului. Cele scoase rămân
    cu progresul salvat, doar dezactivate — o reactivare continuă ciclul."""
    allowed = set(card_type.therapy_ids)
    wanted = set(therapy_ids)
    if not wanted:
        raise HTTPException(status_code=422, detail="Alege cel puțin o terapie pentru card.")
    if not wanted <= allowed:
        raise HTTPException(status_code=422, detail="O terapie aleasă nu face parte din acest tip de card.")
    for progress in card.progress:
        progress.enabled = progress.therapy_id in wanted
    existing = {p.therapy_id for p in card.progress}
    for therapy_id in wanted - existing:
        card.progress.append(
            ClientFidelityCardProgress(therapy_id=therapy_id, enabled=True, stamps=0, discounted_sessions_used=0)
        )


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
            **_serialize_client_card(c).model_dump(), client_id=c.client_id, client_name=c.client.full_name
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
    return [_serialize_client_card(c) for c in cards]


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
    return [_serialize_client_card(c) for c in cards]


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
    _set_card_therapies(card, card_type, payload.therapy_ids if payload.therapy_ids is not None else card_type.therapy_ids)
    db.add(card)
    db.commit()
    db.refresh(card)
    log_audit(db, actor_id=actor.id, action="fidelity_card.issue", target_type="ClientFidelityCard", target_id=card.id, metadata={"client_id": client_id})
    return _serialize_client_card(card)


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
    _set_card_therapies(card, card.card_type, payload.therapy_ids)
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
    return _serialize_client_card(card)


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
