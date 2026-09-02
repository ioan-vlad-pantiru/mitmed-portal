"""dynamic consent types

Revision ID: a8e7baf64f51
Revises: b7e4cd26d15c
Create Date: 2026-09-02 20:15:00.000000

Convertește ConsentType dintr-un enum Postgres fix (GDPR/RISC_PRET) într-un
identificator liber (string), ca ADMIN să poată adăuga tipuri noi de
documente de semnat fără o schimbare de schemă. Scrisă manual (nu
autogenerate) — trecerea enum -> varchar are nevoie de un cast explicit
(USING type::text), iar backfill-ul label-urilor pentru rândurile deja
existente (GDPR/RISC_PRET) nu poate fi dedus automat.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8e7baf64f51'
down_revision: Union[str, Sequence[str], None] = 'b7e4cd26d15c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # consent_templates.type: PK enum -> PK varchar (rămâne PK, doar tipul coloanei se schimbă)
    op.execute("ALTER TABLE consent_templates ALTER COLUMN type TYPE VARCHAR USING type::text")
    op.add_column('consent_templates', sa.Column('label', sa.String(), nullable=True))
    op.add_column(
        'consent_templates', sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.add_column(
        'consent_templates',
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.alter_column('consent_templates', 'created_at', server_default=None)
    op.alter_column('consent_templates', 'active', server_default=None)

    # Backfill label pentru cele două tipuri deja existente (create implicit
    # de _get_or_create_template la prima accesare a /consents).
    op.execute("UPDATE consent_templates SET label = 'Acord GDPR' WHERE type = 'GDPR' AND label IS NULL")
    op.execute(
        "UPDATE consent_templates SET label = 'Declarație riscuri + preț' WHERE type = 'RISC_PRET' AND label IS NULL"
    )
    # Orice alt rând neprevăzut (nu ar trebui să existe) primește eticheta = tipul lui, ca fallback.
    op.execute("UPDATE consent_templates SET label = type WHERE label IS NULL")
    op.alter_column('consent_templates', 'label', nullable=False)

    # consents.type: enum -> varchar (nu mai e legat de enum-ul Postgres)
    op.execute("ALTER TABLE consents ALTER COLUMN type TYPE VARCHAR USING type::text")

    # Enum-ul Postgres nu mai e folosit de nicio coloană — șters ca să nu rămână orfan.
    op.execute("DROP TYPE consent_type")


def downgrade() -> None:
    op.execute("CREATE TYPE consent_type AS ENUM ('GDPR', 'RISC_PRET')")
    op.execute("ALTER TABLE consents ALTER COLUMN type TYPE consent_type USING type::consent_type")
    op.execute("ALTER TABLE consent_templates ALTER COLUMN type TYPE consent_type USING type::consent_type")
    op.drop_column('consent_templates', 'label')
    op.drop_column('consent_templates', 'active')
    op.drop_column('consent_templates', 'created_at')
