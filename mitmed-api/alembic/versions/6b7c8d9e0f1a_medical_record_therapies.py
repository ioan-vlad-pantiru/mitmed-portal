"""several therapies per treatment session

Revision ID: 6b7c8d9e0f1a
Revises: 5a6b7c8d9e0f
Create Date: 2026-10-05 00:00:04.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6b7c8d9e0f1a'
down_revision: Union[str, Sequence[str], None] = '5a6b7c8d9e0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'medical_record_therapies',
        sa.Column('record_id', sa.String(), sa.ForeignKey('medical_records.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('therapy_id', sa.String(), sa.ForeignKey('therapies.id'), primary_key=True),
    )
    op.execute(
        "INSERT INTO medical_record_therapies (record_id, therapy_id) "
        "SELECT id, therapy_id FROM medical_records WHERE therapy_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_table('medical_record_therapies')
