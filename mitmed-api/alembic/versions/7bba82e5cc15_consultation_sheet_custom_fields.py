"""admin-configurable consultation sheet fields

Revision ID: 7bba82e5cc15
Revises: c4d5e6f7a8b9
Create Date: 2026-09-24 00:00:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7bba82e5cc15'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VITALS = "Consultații / Investigații / Evaluări"

# Câmpurile fixe de până acum devin câmpuri configurabile; id-ul = vechea coloană,
# ca valorile existente să se mute 1:1 în field_values.
# (id, label, field_type, section, placeholder, carry_over, old column length)
DEFAULT_FIELDS = [
    ("marital_status", "Starea civilă", "text", None, None, True, 50),
    ("antecedents", "Antecedente", "textarea", None, None, True, None),
    ("working_conditions", "Condiții de muncă", "textarea", None, None, True, None),
    ("blood_pressure", "Tensiune arterială", "text", VITALS, "ex: 120/80", False, 30),
    ("pulse", "Puls", "text", VITALS, "bătăi/min", False, 30),
    ("oxygen_saturation", "Saturație O2", "text", VITALS, "%", False, 30),
    ("glycemia", "Glicemie", "text", VITALS, "mg/dl", False, 30),
    ("symptoms", "Semne și simptome", "textarea", None, None, False, None),
    ("diagnosis", "Diagnostic", "textarea", None, None, False, None),
    ("recommendations", "Recomandări", "textarea", None, None, False, None),
]


def upgrade() -> None:
    fields = op.create_table(
        'consultation_sheet_fields',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('label', sa.String(120), nullable=False),
        sa.Column('field_type', sa.String(20), nullable=False),
        sa.Column('section', sa.String(120)),
        sa.Column('placeholder', sa.String(120)),
        sa.Column('carry_over', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        fields,
        [
            {
                "id": fid, "label": label, "field_type": ftype, "section": section,
                "placeholder": placeholder, "carry_over": carry, "position": i,
                "archived": False, "created_at": now,
            }
            for i, (fid, label, ftype, section, placeholder, carry, _) in enumerate(DEFAULT_FIELDS)
        ],
    )

    op.add_column('consultation_sheets', sa.Column('field_values', sa.JSON(), nullable=False, server_default='{}'))
    pairs = ", ".join(f"'{f[0]}', {f[0]}" for f in DEFAULT_FIELDS)
    op.execute(f"UPDATE consultation_sheets SET field_values = json_strip_nulls(json_build_object({pairs}))")
    op.alter_column('consultation_sheets', 'field_values', server_default=None)
    for f in DEFAULT_FIELDS:
        op.drop_column('consultation_sheets', f[0])


def downgrade() -> None:
    for fid, *_, length in DEFAULT_FIELDS:
        op.add_column('consultation_sheets', sa.Column(fid, sa.String(length) if length else sa.String()))
        value = f"field_values ->> '{fid}'"
        op.execute(f"UPDATE consultation_sheets SET {fid} = {f'left({value}, {length})' if length else value}")
    op.drop_column('consultation_sheets', 'field_values')
    op.drop_table('consultation_sheet_fields')
