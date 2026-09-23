"""consultation therapies + per-client unlocked therapies

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'therapies', sa.Column('is_consultation', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.alter_column('therapies', 'is_consultation', server_default=None)

    op.create_table(
        'client_unlocked_therapies',
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('therapy_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['client_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['therapy_id'], ['therapies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('client_id', 'therapy_id'),
    )


def downgrade() -> None:
    op.drop_table('client_unlocked_therapies')
    op.drop_column('therapies', 'is_consultation')
