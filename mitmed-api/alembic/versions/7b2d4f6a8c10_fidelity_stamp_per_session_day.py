"""fidelity cards: one stamp per session day, not per therapy

Revision ID: 7b2d4f6a8c10
Revises: 5e7a1c3b9d20
Create Date: 2026-11-11 00:00:00.000000

Cardul de fidelitate numără acum ședințe (zile), nu terapii — vezi
services/fidelity.py. Retrage ștampilele în plus deja acordate: pentru fiecare
card, câte plăți ștampilate au căzut în aceeași zi cu altă plată ștampilată pe
același card (ziua programării, altfel ziua înregistrării plății).

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7b2d4f6a8c10'
down_revision: Union[str, Sequence[str], None] = '5e7a1c3b9d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT c.id,
                   c.stamps,
                   COALESCE((SELECT MAX(t.session_number) FROM fidelity_card_tiers t
                             WHERE t.card_type_id = c.card_type_id), 0) AS cycle_length,
                   COUNT(*) - COUNT(DISTINCT (COALESCE(a.starts_at, p.created_at) AT TIME ZONE 'Europe/Bucharest')::date)
                       AS excess
            FROM client_fidelity_cards c
            JOIN payments p ON p.fidelity_stamped_card_id = c.id
            LEFT JOIN appointments a ON a.id = p.appointment_id
            GROUP BY c.id, c.stamps, c.card_type_id
            """
        )
    ).fetchall()
    for card_id, stamps, cycle_length, excess in rows:
        if not excess:
            continue
        new_stamps = (stamps - excess) % cycle_length if cycle_length > 0 else max(stamps - excess, 0)
        conn.execute(
            sa.text("UPDATE client_fidelity_cards SET stamps = :s WHERE id = :id"), {"s": new_stamps, "id": card_id}
        )


def downgrade() -> None:
    # Ștampilele în plus nu se mai reacordă — regula nouă e cea corectă.
    pass
