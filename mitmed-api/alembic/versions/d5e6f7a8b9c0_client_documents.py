"""client documents (arbitrary files attached to a client's file)

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'client_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('uploaded_by_id', sa.String(), nullable=False),
        sa.Column('original_filename', sa.String(), nullable=False),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['client_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_client_documents_client_id'), 'client_documents', ['client_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_client_documents_client_id'), table_name='client_documents')
    op.drop_table('client_documents')
