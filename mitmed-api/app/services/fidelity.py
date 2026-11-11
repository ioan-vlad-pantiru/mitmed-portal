from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session as DBSession

from app.models import Appointment, ClientFidelityCard, Payment
from app.clinic_time import CLINIC_TIMEZONE



# Cardul numără ȘEDINȚE (vizite), nu terapii: toate terapiile plătite pe
# același card în aceeași zi sunt o singură ședință — o singură ștampilă, și
# aceeași poziție în ciclu (deci aceeași reducere) pentru fiecare dintre ele.
# Ziua ședinței e ziua programării; o plată fără programare ține de ziua în
# care a fost înregistrată.


def _clinic_date(moment: datetime) -> date:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(CLINIC_TIMEZONE).date()


def clinic_today() -> date:
    return _clinic_date(datetime.now(timezone.utc))


def session_day(db: DBSession, *, appointment: Appointment | None = None, payment: Payment | None = None) -> date:
    """Ziua ședinței din care face parte o plată (sau o linie de plată încă
    neînregistrată, după programarea ei). Fără programare — ziua de azi
    pentru o linie nouă, ziua înregistrării pentru o plată existentă."""
    if appointment is None and payment is not None and payment.appointment_id:
        appointment = db.get(Appointment, payment.appointment_id)
    if appointment is not None:
        return _clinic_date(appointment.starts_at)
    if payment is not None and payment.created_at is not None:
        return _clinic_date(payment.created_at)
    return clinic_today()


def _stamped_on_day(db: DBSession, card: ClientFidelityCard, day: date, *, exclude_payment_id: str | None = None) -> list[Payment]:
    """Plățile deja ștampilate pe card în ziua dată — adică ședința din acea
    zi e deja numărată."""
    payments = (
        db.query(Payment)
        .filter(Payment.fidelity_stamped_card_id == card.id)
        .all()
    )
    return [p for p in payments if p.id != exclude_payment_id and session_day(db, payment=p) == day]


def find_active_card(db: DBSession, *, client_id: str, therapy_id: str) -> ClientFidelityCard | None:
    """Cardul activ al clientului care contorizează terapia dată, dacă are
    unul — un client poate avea mai multe carduri, fiecare cu terapiile
    activate de admin pentru el. Dacă două carduri active acoperă aceeași
    terapie (blocat doar prin UI), contează cel emis mai recent."""
    cards = (
        db.query(ClientFidelityCard)
        .filter(ClientFidelityCard.client_id == client_id, ClientFidelityCard.active.is_(True))
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return next((c for c in cards if c.card_type.active and therapy_id in c.therapy_ids), None)


def _tier_percent(card: ClientFidelityCard, position: int) -> Decimal | None:
    tier = next((t for t in card.card_type.tiers if t.session_number == position), None)
    return Decimal(tier.discount_percent) if tier else None


def next_session_discount_percent(card: ClientFidelityCard, *, ahead: int = 0) -> Decimal | None:
    """Reducerea pentru o ședință NOUĂ pe acest card — treapta care corespunde
    poziției următoare în ciclu. `ahead` sare peste atâtea ședințe noi
    dinaintea ei din aceeași plată. None dacă nicio treaptă nu se potrivește."""
    cycle_length = card.card_type.cycle_length
    if cycle_length <= 0:
        return None
    return _tier_percent(card, ((card.stamps + ahead) % cycle_length) + 1)


def session_discount_percent(
    db: DBSession, card: ClientFidelityCard, day: date, *, pending_days: list[date] | None = None
) -> Decimal | None:
    """Reducerea pentru o terapie din ședința din ziua `day`. Dacă ședința
    acelei zile e deja ștampilată (altă terapie plătită în aceeași zi), terapia
    ține de ea și primește aceeași treaptă; altfel e o ședință nouă.

    `pending_days` (pentru o plată cu mai multe linii, partajată între ele):
    zilele noi, încă neștampilate, întâlnite până acum pe acest card — fiecare
    zi nouă de dinaintea lui `day` îl împinge cu o poziție mai departe."""
    cycle_length = card.card_type.cycle_length
    if cycle_length <= 0:
        return None
    if _stamped_on_day(db, card, day):
        # `stamps` a fost deja avansat pentru ședința acelei zile — poziția ei
        # e chiar `stamps` (cu revenire la capătul ciclului când stamps == 0).
        return _tier_percent(card, ((card.stamps - 1) % cycle_length) + 1)
    ahead = 0
    if pending_days is not None:
        if day not in pending_days:
            pending_days.append(day)
        ahead = pending_days.index(day)
    return next_session_discount_percent(card, ahead=ahead)


def register_paid_session(db: DBSession, payment: Payment) -> None:
    """Apelată o singură dată, chiar când un Payment individual (nu de
    pachet) devine PLATIT — vezi apelurile din routers/payments.py și
    routers/webhooks.py. Avansează contorul cardului activ al clientului care
    contorizează terapia plătită — o singură dată pe zi (ședință), oricâte
    terapii ar avea ședința.

    Nu face nimic pentru plăți de pachet (au propriul mecanism de ședințe
    incluse, nu se cumulează cu fidelitatea)."""
    if payment.package_total_sessions is not None:
        return
    # Idempotent: o plată deja ștampilată (ex. coborâtă la PARȚIAL printr-o
    # corecție și apoi achitată din nou) nu avansează ciclul a doua oară.
    if payment.fidelity_stamped_card_id:
        return

    card = find_active_card(db, client_id=payment.client_id, therapy_id=payment.therapy_id)
    if not card:
        return

    same_session = _stamped_on_day(db, card, session_day(db, payment=payment), exclude_payment_id=payment.id)
    if not same_session:
        cycle_length = card.card_type.cycle_length
        card.stamps = (card.stamps + 1) % cycle_length if cycle_length > 0 else card.stamps + 1
    # Reducerea se numără o dată pe ședință, nu pe terapie.
    if payment.fidelity_card_id == card.id and not any(p.fidelity_card_id == card.id for p in same_session):
        card.discounted_sessions_used += 1
    payment.fidelity_stamped_card_id = card.id
    db.commit()


def unregister_paid_session(db: DBSession, payment: Payment, *, was_fully_paid: bool) -> None:
    """Inversul lui register_paid_session — retrage ștampila când o plată
    achitată integral e ștearsă sau coborâtă sub integral. Ștampila ședinței
    rămâne cât timp altă terapie din aceeași zi e încă ștampilată. NU face
    commit (apelantul salvează împreună cu modificarea plății).

    Cardul se ia din `fidelity_stamped_card_id`; pentru plățile de dinainte de
    acest câmp, se folosește cardul a cărui reducere a fost aplicată
    (`fidelity_card_id`) — doar dacă plata era într-adevăr achitată integral,
    altfel n-a ștampilat niciodată."""
    card_id = payment.fidelity_stamped_card_id or (payment.fidelity_card_id if was_fully_paid else None)
    if not card_id:
        return
    card = db.get(ClientFidelityCard, card_id)
    if card:
        same_session = _stamped_on_day(db, card, session_day(db, payment=payment), exclude_payment_id=payment.id)
        if not same_session:
            cycle_length = card.card_type.cycle_length
            card.stamps = (card.stamps - 1) % cycle_length if cycle_length > 0 else max(card.stamps - 1, 0)
        if (
            payment.fidelity_card_id == card.id
            and card.discounted_sessions_used > 0
            and not any(p.fidelity_card_id == card.id for p in same_session)
        ):
            card.discounted_sessions_used -= 1
    payment.fidelity_stamped_card_id = None
