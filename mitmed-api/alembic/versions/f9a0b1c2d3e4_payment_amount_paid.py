"""track amount actually paid per payment (partial payments)

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, Sequence[str], None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('payments', sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.alter_column('payments', 'amount_paid', server_default=None)

    # Backfill: rândurile deja PLATIT au evident final_price încasat integral
    # — altfel /insights (care va însuma amount_paid) le-ar arăta ca neîncasate.
    op.execute("UPDATE payments SET amount_paid = final_price WHERE status = 'PLATIT'")


def downgrade() -> None:
    op.drop_column('payments', 'amount_paid')
