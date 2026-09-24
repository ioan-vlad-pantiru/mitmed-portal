from decimal import Decimal

from sqlalchemy.orm import Session as DBSession

from app.models import ClientFidelityCard, Payment


def find_active_card(db: DBSession, *, client_id: str, therapy_id: str) -> ClientFidelityCard | None:
    """Cardul activ al clientului pentru o terapie anume, dacă are unul —
    un client poate avea mai multe carduri (unul per terapie), dar cel mult
    unul activ per terapie are sens (emiterea unui al doilea nu e blocată la
    nivel de bază de date, doar prin UI, ca să nu complice cazul rar al unui
    card revocat + reemis)."""
    cards = (
        db.query(ClientFidelityCard)
        .filter(ClientFidelityCard.client_id == client_id, ClientFidelityCard.active.is_(True))
        .all()
    )
    return next((c for c in cards if c.card_type.therapy_id == therapy_id and c.card_type.active), None)


def next_session_discount_percent(card: ClientFidelityCard) -> Decimal | None:
    """Reducerea care s-ar aplica DACĂ clientul ar plăti acum o nouă ședință
    pe acest card — treapta programului care corespunde poziției curente în
    ciclu. None dacă nicio treaptă nu se potrivește (ex. card fără trepte
    definite, sau o poziție fără reducere configurată)."""
    cycle_length = card.card_type.cycle_length
    if cycle_length <= 0:
        return None
    position = (card.stamps % cycle_length) + 1
    tier = next((t for t in card.card_type.tiers if t.session_number == position), None)
    return Decimal(tier.discount_percent) if tier else None


def register_paid_session(db: DBSession, payment: Payment) -> None:
    """Apelată o singură dată, chiar când un Payment individual (nu de
    pachet) devine PLATIT — vezi apelurile din routers/payments.py și
    routers/webhooks.py. Avansează poziția în ciclu pentru orice card activ
    al clientului pe acea terapie.

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

    cycle_length = card.card_type.cycle_length
    card.stamps = (card.stamps + 1) % cycle_length if cycle_length > 0 else card.stamps + 1
    if payment.fidelity_card_id == card.id:
        card.discounted_sessions_used += 1
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
    if card:
        cycle_length = card.card_type.cycle_length
        card.stamps = (card.stamps - 1) % cycle_length if cycle_length > 0 else max(card.stamps - 1, 0)
        if payment.fidelity_card_id == card.id and card.discounted_sessions_used > 0:
            card.discounted_sessions_used -= 1
    payment.fidelity_stamped_card_id = None
