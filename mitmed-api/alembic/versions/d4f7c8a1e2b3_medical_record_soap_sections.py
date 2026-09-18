"""Add structured SOAP sections to medical records.

Revision ID: d4f7c8a1e2b3
Revises: c9d6e5f4a3b2
Create Date: 2026-09-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f7c8a1e2b3"
down_revision: Union[str, Sequence[str], None] = "c9d6e5f4a3b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("medical_records", sa.Column("subjective", sa.String(), nullable=True))
    op.add_column("medical_records", sa.Column("objective", sa.String(), nullable=True))
    op.add_column("medical_records", sa.Column("assessment", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("medical_records", "assessment")
    op.drop_column("medical_records", "objective")
    op.drop_column("medical_records", "subjective")
