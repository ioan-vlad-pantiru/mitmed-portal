"""two appointment reminders (day-before + hour-before)

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, Sequence[str], None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Redenumit, nu recreat — programările pentru care s-a trimis deja
    # reminderul "cu o zi înainte" își păstrează starea, nu primesc un al
    # doilea reminder identic doar pentru că a apărut coloana nouă.
    op.alter_column('appointments', 'reminder_sent_at', new_column_name='reminder_day_before_sent_at')
    op.add_column('appointments', sa.Column('reminder_hour_before_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('appointments', 'reminder_hour_before_sent_at')
    op.alter_column('appointments', 'reminder_day_before_sent_at', new_column_name='reminder_sent_at')
