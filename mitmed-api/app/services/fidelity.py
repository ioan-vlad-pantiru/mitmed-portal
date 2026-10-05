from decimal import Decimal

from sqlalchemy.orm import Session as DBSession

from app.models import ClientFidelityCard, Payment


def find_active_card(db: DBSession, *, client_id: str, therapy_id: str) -> ClientFidelityCard | None:
    """Cardul activ al clientului care contorizează terapia dată, dacă are
    unul — un client poate avea mai multe carduri, fiecare cu terapiile
    activate de admin pentru el. Dacă două carduri active acoperă aceeași terapie (blocat doar
    prin UI), contează cel emis mai recent."""
    cards = (
        db.query(ClientFidelityCard)
        .filter(ClientFidelityCard.client_id == client_id, ClientFidelityCard.active.is_(True))
        .order_by(ClientFidelityCard.issued_at.desc())
        .all()
    )
    return next((c for c in cards if c.card_type.active and therapy_id in c.therapy_ids), None)


def card_stamps(card: ClientFidelityCard, therapy_id: str) -> int:
    progress = card.progress_for(therapy_id)
    return progress.stamps if progress else 0


def next_session_discount_percent(card: ClientFidelityCard, therapy_id: str, *, ahead: int = 0) -> Decimal | None:
    """Reducerea care s-ar aplica DACĂ clientul ar plăti acum o nouă ședință
    din terapia dată pe acest card — treapta terapiei care corespunde poziției
    curente în ciclul ei. `ahead` sare peste atâtea ședințe deja puse în
    aceeași plată (ex. a 2-a ședință de masaj dintr-o plată cu mai multe
    terapii e cu o poziție mai departe în ciclu). None dacă nicio treaptă nu
    se potrivește."""
    cycle_length = card.card_type.cycle_length(therapy_id)
    if cycle_length <= 0:
        return None
    position = ((card_stamps(card, therapy_id) + ahead) % cycle_length) + 1
    tier = next((t for t in card.card_type.tiers_for(therapy_id) if t.session_number == position), None)
    return Decimal(tier.discount_percent) if tier else None


def register_paid_session(db: DBSession, payment: Payment) -> None:
    """Apelată o singură dată, chiar când un Payment individual (nu de
    pachet) devine PLATIT — vezi apelurile din routers/payments.py și
    routers/webhooks.py. Avansează poziția în ciclul terapiei plătite pe
    cardul activ al clientului care o contorizează.

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

    # Există mereu — find_active_card întoarce doar carduri pe care terapia
    # e activată, adică are rând de progres.
    progress = card.progress_for(payment.therapy_id)
    cycle_length = card.card_type.cycle_length(payment.therapy_id)
    progress.stamps = (progress.stamps + 1) % cycle_length if cycle_length > 0 else progress.stamps + 1
    if payment.fidelity_card_id == card.id:
        progress.discounted_sessions_used += 1
    payment.fidelity_stamped_card_id = card.id
    db.commit()


def unregister_paid_session(db: DBSession, payment: Payment, *, was_fully_paid: bool) -> None:
    """Inversul lui register_paid_session — retrage ștampila când o plată
    achitată integral e ștearsă sau coborâtă sub integral. NU face commit
    (apelantul salvează împreună cu modificarea plății).

    Cardul se ia din `fidelity_stamped_card_id`; pentru plățile de dinainte de
    acest câmp, se folosește cardul a cărui reducere a fost aplicată
    (`fidelity_card_id`) — doar dacă plata era într-adevăr achitată integral,
    altfel n-a ștampilat niciodată."""
    card_id = payment.fidelity_stamped_card_id or (payment.fidelity_card_id if was_fully_paid else None)
    if not card_id:
        return
    card = db.get(ClientFidelityCard, card_id)
    progress = card.progress_for(payment.therapy_id) if card else None
    if progress:
        cycle_length = card.card_type.cycle_length(payment.therapy_id)
        progress.stamps = (progress.stamps - 1) % cycle_length if cycle_length > 0 else max(progress.stamps - 1, 0)
        if payment.fidelity_card_id == card.id and progress.discounted_sessions_used > 0:
            progress.discounted_sessions_used -= 1
    payment.fidelity_stamped_card_id = None
