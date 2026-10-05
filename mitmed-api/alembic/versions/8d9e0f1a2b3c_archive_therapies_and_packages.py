"""archive therapies and packages that already have history instead of deleting them

Revision ID: 8d9e0f1a2b3c
Revises: 7c8d9e0f1a2b
Create Date: 2026-10-05 00:00:06.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8d9e0f1a2b3c'
down_revision: Union[str, Sequence[str], None] = '7c8d9e0f1a2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('therapies', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('therapy_packages', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('therapy_packages', 'archived_at')
    op.drop_column('therapies', 'archived_at')
