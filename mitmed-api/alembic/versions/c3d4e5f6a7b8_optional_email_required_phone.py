"""optional user email, unique phone login identifier for clients

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Email devine opțional: conturile de admin/recepție continuă să-l
    # folosească, dar clienții se pot înregistra doar cu telefon.
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=True)

    # Indice unic parțial pe telefon — ignoră rândurile cu telefon NULL, ca
    # să nu pice pe clienți existenți fără telefon completat. Permite
    # folosirea telefonului ca identificator de login.
    op.create_index(
        'ix_client_profiles_phone_unique',
        'client_profiles',
        ['phone'],
        unique=True,
        postgresql_where=sa.text('phone IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_client_profiles_phone_unique', table_name='client_profiles')
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=False)
