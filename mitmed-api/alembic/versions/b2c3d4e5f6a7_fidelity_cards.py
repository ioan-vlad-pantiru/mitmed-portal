"""fidelity cards (admin-defined tiered discount schedules + issued client cards)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fidelity_card_types',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('therapy_id', sa.String(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['therapy_id'], ['therapies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'fidelity_card_tiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('card_type_id', sa.String(), nullable=False),
        sa.Column('session_number', sa.Integer(), nullable=False),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False),
        sa.ForeignKeyConstraint(['card_type_id'], ['fidelity_card_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_fidelity_card_tiers_card_type_id'), 'fidelity_card_tiers', ['card_type_id'], unique=False
    )
    op.create_index(
        'ux_fidelity_card_tiers_type_session', 'fidelity_card_tiers', ['card_type_id', 'session_number'], unique=True
    )

    op.create_table(
        'client_fidelity_cards',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('card_type_id', sa.String(), nullable=False),
        sa.Column('issued_by_id', sa.String(), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('stamps', sa.Integer(), nullable=False),
        sa.Column('discounted_sessions_used', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['client_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['card_type_id'], ['fidelity_card_types.id']),
        sa.ForeignKeyConstraint(['issued_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_client_fidelity_cards_client_id'), 'client_fidelity_cards', ['client_id'], unique=False
    )

    op.add_column('payments', sa.Column('fidelity_card_id', sa.String(), nullable=True))
    op.create_foreign_key(
        'payments_fidelity_card_id_fkey', 'payments', 'client_fidelity_cards', ['fidelity_card_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('payments_fidelity_card_id_fkey', 'payments', type_='foreignkey')
    op.drop_column('payments', 'fidelity_card_id')
    op.drop_index(op.f('ix_client_fidelity_cards_client_id'), table_name='client_fidelity_cards')
    op.drop_table('client_fidelity_cards')
    op.drop_index('ux_fidelity_card_tiers_type_session', table_name='fidelity_card_tiers')
    op.drop_index(op.f('ix_fidelity_card_tiers_card_type_id'), table_name='fidelity_card_tiers')
    op.drop_table('fidelity_card_tiers')
    op.drop_table('fidelity_card_types')
