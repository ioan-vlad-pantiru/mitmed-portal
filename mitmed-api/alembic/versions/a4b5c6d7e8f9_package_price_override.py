"""package total editable after the discount

Revision ID: a4b5c6d7e8f9
Revises: 7bba82e5cc15
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, Sequence[str], None] = '7bba82e5cc15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('therapy_packages', sa.Column('price_override', sa.Numeric(10, 2)))


def downgrade() -> None:
    op.drop_column('therapy_packages', 'price_override')
