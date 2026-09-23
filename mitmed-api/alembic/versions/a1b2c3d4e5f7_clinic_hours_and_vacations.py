"""editable clinic hours + vacations

Revision ID: a1b2c3d4e5f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-23 00:00:00.000000

"""
from datetime import time
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weekday_hours',
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('is_open', sa.Boolean(), nullable=False),
        sa.Column('opens_at', sa.Time(), nullable=True),
        sa.Column('closes_at', sa.Time(), nullable=True),
        sa.Column('break_starts_at', sa.Time(), nullable=True),
        sa.Column('break_ends_at', sa.Time(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('weekday'),
    )
    op.create_table(
        'clinic_vacations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('ends_on', sa.Date(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('created_by_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # Preia programul hardcodat existent (luni-vineri 10:00-18:00, pauză
    # 13:00-14:00; weekend închis), ca migrarea să nu schimbe comportamentul
    # curent — admin îl poate edita oricând după asta din /admin/program.
    weekday_hours = sa.table(
        'weekday_hours',
        sa.column('weekday', sa.Integer()),
        sa.column('is_open', sa.Boolean()),
        sa.column('opens_at', sa.Time()),
        sa.column('closes_at', sa.Time()),
        sa.column('break_starts_at', sa.Time()),
        sa.column('break_ends_at', sa.Time()),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )
    now = sa.func.now()
    for day in range(7):
        is_weekday = day < 5
        op.execute(
            weekday_hours.insert().values(
                weekday=day,
                is_open=is_weekday,
                opens_at=time(10, 0) if is_weekday else None,
                closes_at=time(18, 0) if is_weekday else None,
                break_starts_at=time(13, 0) if is_weekday else None,
                break_ends_at=time(14, 0) if is_weekday else None,
                updated_at=now,
            )
        )


def downgrade() -> None:
    op.drop_table('clinic_vacations')
    op.drop_table('weekday_hours')
