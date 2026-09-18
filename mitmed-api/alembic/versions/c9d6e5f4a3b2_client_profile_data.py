"""optional client profile data

Revision ID: c9d6e5f4a3b2
Revises: f8b83e9a0b2a
Create Date: 2026-09-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d6e5f4a3b2"
down_revision: Union[str, Sequence[str], None] = "f8b83e9a0b2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("client_profiles", sa.Column("profile_data", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("client_profiles", "profile_data")
