"""fidelity cards: one shared counter and one threshold schedule per card

Revision ID: 9e0f1a2b3c4d
Revises: 8d9e0f1a2b3c
Create Date: 2026-10-05 00:00:07.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9e0f1a2b3c4d'
down_revision: Union[str, Sequence[str], None] = '8d9e0f1a2b3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Terapiile tipului de card devin o listă proprie (până acum reieșeau din trepte).
    op.create_table(
        'fidelity_card_type_therapies',
        sa.Column('card_type_id', sa.String(), sa.ForeignKey('fidelity_card_types.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('therapy_id', sa.String(), sa.ForeignKey('therapies.id', ondelete='CASCADE'), primary_key=True),
    )
    op.execute(
        "INSERT INTO fidelity_card_type_therapies (card_type_id, therapy_id) "
        "SELECT DISTINCT card_type_id, therapy_id FROM fidelity_card_tiers"
    )

    # Un singur program per card: treptele terapiilor se reunesc; la același
    # număr de ședință rămâne reducerea cea mai mare.
    op.execute(
        "UPDATE fidelity_card_tiers t SET discount_percent = m.mx FROM ("
        "  SELECT card_type_id, session_number, max(discount_percent) AS mx"
        "  FROM fidelity_card_tiers GROUP BY card_type_id, session_number"
        ") m WHERE m.card_type_id = t.card_type_id AND m.session_number = t.session_number"
    )
    op.execute(
        "DELETE FROM fidelity_card_tiers a USING fidelity_card_tiers b "
        "WHERE a.card_type_id = b.card_type_id AND a.session_number = b.session_number AND a.id > b.id"
    )
    op.drop_index('ux_fidelity_card_tiers_type_therapy_session', table_name='fidelity_card_tiers')
    op.drop_constraint('fidelity_card_tiers_therapy_id_fkey', 'fidelity_card_tiers', type_='foreignkey')
    op.drop_column('fidelity_card_tiers', 'therapy_id')
    op.create_index(
        'ux_fidelity_card_tiers_type_session', 'fidelity_card_tiers', ['card_type_id', 'session_number'], unique=True
    )

    # Terapiile activate pentru fiecare client + un singur contor per card
    # (suma contoarelor vechi pe terapii, readusă în noul ciclu).
    op.create_table(
        'client_fidelity_card_therapies',
        sa.Column('card_id', sa.String(), sa.ForeignKey('client_fidelity_cards.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('therapy_id', sa.String(), sa.ForeignKey('therapies.id', ondelete='CASCADE'), primary_key=True),
    )
    op.execute(
        "INSERT INTO client_fidelity_card_therapies (card_id, therapy_id) "
        "SELECT card_id, therapy_id FROM client_fidelity_card_progress WHERE enabled"
    )
    op.add_column('client_fidelity_cards', sa.Column('stamps', sa.Integer(), nullable=False, server_default='0'))
    op.add_column(
        'client_fidelity_cards', sa.Column('discounted_sessions_used', sa.Integer(), nullable=False, server_default='0')
    )
    op.execute(
        "UPDATE client_fidelity_cards c SET "
        "  stamps = CASE WHEN cyc.len > 0 THEN p.stamps % cyc.len ELSE p.stamps END, "
        "  discounted_sessions_used = p.discounted "
        "FROM ("
        "  SELECT card_id, sum(stamps) FILTER (WHERE enabled) AS stamps, sum(discounted_sessions_used) AS discounted"
        "  FROM client_fidelity_card_progress GROUP BY card_id"
        ") p, ("
        "  SELECT ct.id, coalesce(max(t.session_number), 0) AS len FROM fidelity_card_types ct"
        "  LEFT JOIN fidelity_card_tiers t ON t.card_type_id = ct.id GROUP BY ct.id"
        ") cyc "
        "WHERE p.card_id = c.id AND cyc.id = c.card_type_id"
    )
    op.execute("UPDATE client_fidelity_cards SET stamps = 0 WHERE stamps IS NULL")
    op.drop_table('client_fidelity_card_progress')


def downgrade() -> None:
    # Fiecare terapie primește din nou o copie a programului cardului; contorul
    # comun trece pe prima terapie (alfabetic după id) a cardului.
    op.create_table(
        'client_fidelity_card_progress',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('card_id', sa.String(), nullable=False),
        sa.Column('therapy_id', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('stamps', sa.Integer(), nullable=False),
        sa.Column('discounted_sessions_used', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['card_id'], ['client_fidelity_cards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['therapy_id'], ['therapies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_client_fidelity_card_progress_card_id'), 'client_fidelity_card_progress', ['card_id'], unique=False
    )
    op.create_index(
        'ux_client_fidelity_card_progress_card_therapy',
        'client_fidelity_card_progress',
        ['card_id', 'therapy_id'],
        unique=True,
    )
    op.execute(
        "INSERT INTO client_fidelity_card_progress (id, card_id, therapy_id, enabled, stamps, discounted_sessions_used) "
        "SELECT replace(gen_random_uuid()::text, '-', ''), ct.card_id, ct.therapy_id, true, "
        "  CASE WHEN ct.therapy_id = f.first_id THEN c.stamps ELSE 0 END, "
        "  CASE WHEN ct.therapy_id = f.first_id THEN c.discounted_sessions_used ELSE 0 END "
        "FROM client_fidelity_card_therapies ct JOIN client_fidelity_cards c ON c.id = ct.card_id "
        "JOIN (SELECT card_id, min(therapy_id) AS first_id FROM client_fidelity_card_therapies GROUP BY card_id) f "
        "  ON f.card_id = ct.card_id"
    )
    op.drop_column('client_fidelity_cards', 'discounted_sessions_used')
    op.drop_column('client_fidelity_cards', 'stamps')
    op.drop_table('client_fidelity_card_therapies')

    op.drop_index('ux_fidelity_card_tiers_type_session', table_name='fidelity_card_tiers')
    op.add_column('fidelity_card_tiers', sa.Column('therapy_id', sa.String(), nullable=True))
    op.execute(
        "INSERT INTO fidelity_card_tiers (id, card_type_id, session_number, discount_percent, therapy_id) "
        "SELECT replace(gen_random_uuid()::text, '-', ''), t.card_type_id, t.session_number, t.discount_percent, "
        "  tt.therapy_id "
        "FROM fidelity_card_tiers t JOIN fidelity_card_type_therapies tt ON tt.card_type_id = t.card_type_id"
    )
    op.execute("DELETE FROM fidelity_card_tiers WHERE therapy_id IS NULL")
    op.alter_column('fidelity_card_tiers', 'therapy_id', nullable=False)
    op.create_foreign_key(
        'fidelity_card_tiers_therapy_id_fkey', 'fidelity_card_tiers', 'therapies', ['therapy_id'], ['id']
    )
    op.create_index(
        'ux_fidelity_card_tiers_type_therapy_session',
        'fidelity_card_tiers',
        ['card_type_id', 'therapy_id', 'session_number'],
        unique=True,
    )
    op.drop_table('fidelity_card_type_therapies')
