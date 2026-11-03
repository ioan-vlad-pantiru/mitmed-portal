"""satisfaction survey

Revision ID: 5e7a1c3b9d20
Revises: a1b2c3d4e5f6
Create Date: 2026-11-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5e7a1c3b9d20'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Întrebările de pornire — adminul le poate schimba sau șterge din Setări.
DEFAULT_QUESTIONS = [
    ("q_overall", "Cum ți s-a părut, per total, experiența la MitMed?", "rating", None, True),
    ("q_therapist", "Cât de mulțumit ești de terapeut?", "rating", None, False),
    ("q_reception", "Cum ți s-a părut primirea la recepție și programarea?", "rating", None, False),
    ("q_clean", "Cât de curat și confortabil ți s-a părut cabinetul?", "rating", None, False),
    ("q_recommend", "Ne-ai recomanda prietenilor sau familiei?", "choice", ["Da", "Poate", "Nu"], False),
    ("q_comment", "Ce am putea face mai bine?", "text", None, False),
]


def upgrade() -> None:
    op.create_table(
        'survey_questions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False, server_default='rating'),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('required', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('archived', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'survey_responses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('client_id', sa.String(), sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('appointment_id', sa.String(), sa.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True, unique=True),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_survey_responses_client_id', 'survey_responses', ['client_id'])
    op.create_index('ix_survey_responses_created_at', 'survey_responses', ['created_at'])
    op.create_table(
        'survey_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('google_review_url', sa.String(500), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    questions = sa.table(
        'survey_questions',
        sa.column('id', sa.String()), sa.column('label', sa.String()), sa.column('kind', sa.String()),
        sa.column('options', sa.JSON()), sa.column('required', sa.Boolean()), sa.column('position', sa.Integer()),
    )
    op.bulk_insert(questions, [
        {"id": qid, "label": label, "kind": kind, "options": options, "required": required, "position": i}
        for i, (qid, label, kind, options, required) in enumerate(DEFAULT_QUESTIONS)
    ])
    op.execute("INSERT INTO survey_settings (id, enabled) VALUES (1, true)")


def downgrade() -> None:
    op.drop_table('survey_settings')
    op.drop_index('ix_survey_responses_created_at', table_name='survey_responses')
    op.drop_index('ix_survey_responses_client_id', table_name='survey_responses')
    op.drop_table('survey_responses')
    op.drop_table('survey_questions')
