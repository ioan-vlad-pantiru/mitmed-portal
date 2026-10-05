"""fidelity cards cover several therapies, each with its own tiers and counter

Revision ID: 7c8d9e0f1a2b
Revises: 6b7c8d9e0f1a
Create Date: 2026-10-05 00:00:05.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7c8d9e0f1a2b'
down_revision: Union[str, Sequence[str], None] = '6b7c8d9e0f1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Treptele devin per terapie — cele existente aparțin terapiei unice a
    # tipului de card.
    op.add_column('fidelity_card_tiers', sa.Column('therapy_id', sa.String(), nullable=True))
    op.execute(
        "UPDATE fidelity_card_tiers t SET therapy_id = ct.therapy_id "
        "FROM fidelity_card_types ct WHERE ct.id = t.card_type_id"
    )
    op.alter_column('fidelity_card_tiers', 'therapy_id', nullable=False)
    op.create_foreign_key(
        'fidelity_card_tiers_therapy_id_fkey', 'fidelity_card_tiers', 'therapies', ['therapy_id'], ['id']
    )
    op.drop_index('ux_fidelity_card_tiers_type_session', table_name='fidelity_card_tiers')
    op.create_index(
        'ux_fidelity_card_tiers_type_therapy_session',
        'fidelity_card_tiers',
        ['card_type_id', 'therapy_id', 'session_number'],
        unique=True,
    )

    # Progresul cardurilor emise se mută într-un rând per (card, terapie) —
    # existența rândului (enabled) înseamnă și că terapia se aplică clientului.
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
        "SELECT replace(gen_random_uuid()::text, '-', ''), c.id, ct.therapy_id, true, c.stamps, c.discounted_sessions_used "
        "FROM client_fidelity_cards c JOIN fidelity_card_types ct ON ct.id = c.card_type_id"
    )
    op.drop_column('client_fidelity_cards', 'stamps')
    op.drop_column('client_fidelity_cards', 'discounted_sessions_used')
    op.drop_constraint('fidelity_card_types_therapy_id_fkey', 'fidelity_card_types', type_='foreignkey')
    op.drop_column('fidelity_card_types', 'therapy_id')


def downgrade() -> None:
    # Pierde informație dacă un tip are mai multe terapii — păstrează doar
    # prima terapie (alfabetic după id) și progresul ei.
    op.add_column('fidelity_card_types', sa.Column('therapy_id', sa.String(), nullable=True))
    op.execute(
        "UPDATE fidelity_card_types ct SET therapy_id = "
        "(SELECT min(t.therapy_id) FROM fidelity_card_tiers t WHERE t.card_type_id = ct.id)"
    )
    op.execute("DELETE FROM fidelity_card_tiers t USING fidelity_card_types ct "
               "WHERE ct.id = t.card_type_id AND t.therapy_id <> ct.therapy_id")
    op.create_foreign_key(
        'fidelity_card_types_therapy_id_fkey', 'fidelity_card_types', 'therapies', ['therapy_id'], ['id']
    )

    op.add_column('client_fidelity_cards', sa.Column('stamps', sa.Integer(), nullable=False, server_default='0'))
    op.add_column(
        'client_fidelity_cards',
        sa.Column('discounted_sessions_used', sa.Integer(), nullable=False, server_default='0'),
    )
    op.execute(
        "UPDATE client_fidelity_cards c SET stamps = p.stamps, discounted_sessions_used = p.discounted_sessions_used "
        "FROM client_fidelity_card_progress p, fidelity_card_types ct "
        "WHERE p.card_id = c.id AND ct.id = c.card_type_id AND p.therapy_id = ct.therapy_id"
    )
    op.drop_index('ux_client_fidelity_card_progress_card_therapy', table_name='client_fidelity_card_progress')
    op.drop_index(op.f('ix_client_fidelity_card_progress_card_id'), table_name='client_fidelity_card_progress')
    op.drop_table('client_fidelity_card_progress')

    op.drop_index('ux_fidelity_card_tiers_type_therapy_session', table_name='fidelity_card_tiers')
    op.create_index(
        'ux_fidelity_card_tiers_type_session', 'fidelity_card_tiers', ['card_type_id', 'session_number'], unique=True
    )
    op.drop_constraint('fidelity_card_tiers_therapy_id_fkey', 'fidelity_card_tiers', type_='foreignkey')
    op.drop_column('fidelity_card_tiers', 'therapy_id')
