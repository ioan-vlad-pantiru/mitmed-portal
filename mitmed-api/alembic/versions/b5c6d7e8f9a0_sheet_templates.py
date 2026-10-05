"""sheet templates: consultation, treatment and admin-built medical sheets

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-10-05 00:00:01.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, Sequence[str], None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    templates = op.create_table(
        'sheet_templates',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('description', sa.String(300)),
        sa.Column('visible_to_client', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        templates,
        [
            {
                "id": "consultatie", "name": "Fișă de consultație", "kind": "consultatie",
                "description": "Fișa de consultații și evaluări medicale — prima vizită și reconsult.",
                "visible_to_client": True, "position": 0, "archived": False, "created_at": now,
            },
            {
                "id": "tratament", "name": "Fișă de tratament", "kind": "tratament",
                "description": "Completată la fiecare ședință: proceduri efectuate, desfășurarea ședinței, semne și simptome.",
                "visible_to_client": False, "position": 1, "archived": False, "created_at": now,
            },
        ],
    )

    for table in ('consultation_sheet_fields', 'consultation_sheets'):
        op.add_column(
            table,
            sa.Column('template_id', sa.String(), sa.ForeignKey('sheet_templates.id'), nullable=False, server_default='consultatie'),
        )
        op.alter_column(table, 'template_id', server_default=None)
        op.create_index(f'ix_{table}_template_id', table, ['template_id'])

    op.add_column('medical_records', sa.Column('field_values', sa.JSON()))

    # O căsuță de pornire pe fișa de tratament (restul — SOAP — sunt fixe).
    op.execute(
        sa.text(
            "INSERT INTO consultation_sheet_fields "
            "(id, template_id, label, field_type, section, placeholder, carry_over, position, archived, created_at) "
            "VALUES ('tr_symptoms', 'tratament', 'Semne și simptome pe parcursul ședinței', 'textarea', "
            "NULL, NULL, false, 0, false, :now)"
        ).bindparams(now=now)
    )


def downgrade() -> None:
    op.execute("DELETE FROM consultation_sheets WHERE template_id <> 'consultatie'")
    op.execute("DELETE FROM consultation_sheet_fields WHERE template_id <> 'consultatie'")
    op.drop_column('medical_records', 'field_values')
    for table in ('consultation_sheets', 'consultation_sheet_fields'):
        op.drop_index(f'ix_{table}_template_id', table_name=table)
        op.drop_column(table, 'template_id')
    op.drop_table('sheet_templates')
