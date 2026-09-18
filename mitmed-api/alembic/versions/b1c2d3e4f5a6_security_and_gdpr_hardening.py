"""security and gdpr hardening: login lockout, consent withdrawal/category,
data subject requests, unique active appointment slot

Revision ID: b1c2d3e4f5a6
Revises: a3f9c1d7e8b4
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a3f9c1d7e8b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("users", "failed_login_attempts", server_default=None)

    op.add_column(
        "consent_templates", sa.Column("category", sa.String(), nullable=False, server_default="TRATAMENT")
    )
    op.alter_column("consent_templates", "category", server_default=None)

    op.add_column("consents", sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "data_subject_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("client_id", sa.String(), nullable=False),
        sa.Column("type", sa.Enum("EXPORT", "ERASURE", name="data_request_type"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "COMPLETED", "REJECTED", name="data_request_status"),
            nullable=False,
        ),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("resolved_by_id", sa.String(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_subject_requests_client_id", "data_subject_requests", ["client_id"])

    # Interzice la nivel de DB două programări active pe aceeași terapie+oră.
    # NOTĂ: dacă rulează pe o bază cu dubluri deja existente printre
    # programările PROGRAMATA/CONFIRMATA, această comandă eșuează — rezolvați
    # manual dublurile înainte de a re-rula migrarea.
    op.create_index(
        "ux_appointments_active_slot",
        "appointments",
        ["therapy_id", "starts_at"],
        unique=True,
        postgresql_where=sa.text("status IN ('PROGRAMATA', 'CONFIRMATA')"),
    )


def downgrade() -> None:
    op.drop_index("ux_appointments_active_slot", table_name="appointments")
    op.drop_index("ix_data_subject_requests_client_id", table_name="data_subject_requests")
    op.drop_table("data_subject_requests")
    data_request_status = sa.Enum("PENDING", "COMPLETED", "REJECTED", name="data_request_status")
    data_request_type = sa.Enum("EXPORT", "ERASURE", name="data_request_type")
    data_request_status.drop(op.get_bind())
    data_request_type.drop(op.get_bind())
    op.drop_column("consents", "withdrawn_at")
    op.drop_column("consent_templates", "category")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
