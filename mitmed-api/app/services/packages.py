from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models import Payment


def consume_package_session(db: DBSession, *, client_id: str, therapy_id: str) -> Payment | None:
    """Scade o ședință din cel mai vechi pachet neepuizat al clientului pentru
    acea terapie (FIFO). O ședință unică (fără pachet) nu are ce să scadă —
    nu face nimic. Oglindește lib/packages.ts."""
    candidates = (
        db.execute(
            select(Payment)
            .where(
                Payment.client_id == client_id,
                Payment.therapy_id == therapy_id,
                Payment.package_total_sessions.is_not(None),
            )
            .order_by(Payment.created_at.asc())
        )
        .scalars()
        .all()
    )

    target = next((p for p in candidates if p.sessions_used < (p.package_total_sessions or 0)), None)
    if not target:
        return None

    target.sessions_used += 1
    db.commit()
    db.refresh(target)
    return target
