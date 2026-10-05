"""link a sheet to the appointment it was filled in

Revision ID: 5a6b7c8d9e0f
Revises: c6d7e8f9a0b1
Create Date: 2026-10-05 00:00:03.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5a6b7c8d9e0f'
down_revision: Union[str, Sequence[str], None] = 'c6d7e8f9a0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'consultation_sheets',
        sa.Column('appointment_id', sa.String(), sa.ForeignKey('appointments.id', ondelete='SET NULL')),
    )
    op.create_index('ix_consultation_sheets_appointment_id', 'consultation_sheets', ['appointment_id'])


def downgrade() -> None:
    op.drop_index('ix_consultation_sheets_appointment_id', table_name='consultation_sheets')
    op.drop_column('consultation_sheets', 'appointment_id')
