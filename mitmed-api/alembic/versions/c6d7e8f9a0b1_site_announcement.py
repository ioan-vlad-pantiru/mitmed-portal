"""editable announcement bar for the presentation site

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-10-05 00:00:02.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, Sequence[str], None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    table = op.create_table(
        'site_announcement',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('text', sa.String(300), nullable=False),
        sa.Column('mobile_text', sa.String(120)),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    # Textul afișat până acum pe site (hardcodat în AnnouncementBar.tsx).
    op.bulk_insert(
        table,
        [
            {
                "id": 1,
                "enabled": True,
                "text": "10+ ani de experiență în fiziokinetoterapie, acum și în Bulevardul Oituz 18: programează-te printre primii pacienți.",
                "mobile_text": "10+ ani de experiență, acum și în Onești.",
                "updated_at": datetime.now(timezone.utc),
            }
        ],
    )


def downgrade() -> None:
    op.drop_table('site_announcement')
