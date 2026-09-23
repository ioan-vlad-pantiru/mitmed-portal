"""track split cash/card amounts on a payment (mixed-method mark-paid)

Revision ID: a2b3c4d5e6f7
Revises: f9a0b1c2d3e4
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('payments', sa.Column('amount_paid_cash', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('payments', sa.Column('amount_paid_card', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.alter_column('payments', 'amount_paid_cash', server_default=None)
    op.alter_column('payments', 'amount_paid_card', server_default=None)


def downgrade() -> None:
    op.drop_column('payments', 'amount_paid_card')
    op.drop_column('payments', 'amount_paid_cash')
