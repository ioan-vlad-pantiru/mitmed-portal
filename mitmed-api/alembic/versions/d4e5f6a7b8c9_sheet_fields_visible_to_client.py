"""sheet fields: mark which ones the client sees in the portal

Revision ID: d4e5f6a7b8c9
Revises: c3d9e1f2a4b6
Create Date: 2026-11-11 21:00:00.000000

Until now the client saw a consultation sheet only as a PDF, so the
"Diagnostic" and "Recomandări" written there never reached "Dosarul meu".
Each field now says whether the client sees it; those two start switched on.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d9e1f2a4b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "consultation_sheet_fields",
        sa.Column("visible_to_client", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        "UPDATE consultation_sheet_fields SET visible_to_client = true "
        "WHERE template_id = 'consultatie' AND lower(label) IN ('diagnostic', 'recomandări', 'recomandari')"
    )


def downgrade() -> None:
    op.drop_column("consultation_sheet_fields", "visible_to_client")
