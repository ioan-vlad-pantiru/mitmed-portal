"""consultation sheets (fisa de consultatii si evaluari medicale)

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'consultation_sheets',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('client_id', sa.String(), sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('sheet_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('sheet_number', sa.String(30)),
        sa.Column('marital_status', sa.String(50)),
        sa.Column('antecedents', sa.String()),
        sa.Column('working_conditions', sa.String()),
        sa.Column('blood_pressure', sa.String(30)),
        sa.Column('pulse', sa.String(30)),
        sa.Column('oxygen_saturation', sa.String(30)),
        sa.Column('glycemia', sa.String(30)),
        sa.Column('symptoms', sa.String()),
        sa.Column('diagnosis', sa.String()),
        sa.Column('recommendations', sa.String()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_consultation_sheets_client_id', 'consultation_sheets', ['client_id'])


def downgrade() -> None:
    op.drop_index('ix_consultation_sheets_client_id', table_name='consultation_sheets')
    op.drop_table('consultation_sheets')
