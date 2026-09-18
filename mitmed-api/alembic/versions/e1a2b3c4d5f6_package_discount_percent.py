"""package price -> discount_percent (auto-calculated pricing)

Revision ID: e1a2b3c4d5f6
Revises: f8b83e9a0b2a
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5f6'
down_revision: Union[str, Sequence[str], None] = 'd4f7c8a1e2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('therapy_packages', sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))

    # Derivă reducerea existentă din prețul fix salvat anterior, ca pachetele
    # deja create să nu-și schimbe prețul de vânzare după migrare.
    conn = op.get_bind()
    packages = conn.execute(sa.text("SELECT id, price FROM therapy_packages")).fetchall()
    for package_id, price in packages:
        list_price_row = conn.execute(
            sa.text(
                "SELECT COALESCE(SUM(t.price * pi.sessions_included), 0) "
                "FROM package_items pi JOIN therapies t ON t.id = pi.therapy_id "
                "WHERE pi.package_id = :package_id"
            ),
            {"package_id": package_id},
        ).scalar()
        list_price = float(list_price_row or 0)
        discount_percent = round((1 - float(price) / list_price) * 100, 2) if list_price > 0 else 0
        discount_percent = max(0, min(100, discount_percent))
        conn.execute(
            sa.text("UPDATE therapy_packages SET discount_percent = :discount WHERE id = :package_id"),
            {"discount": discount_percent, "package_id": package_id},
        )

    op.alter_column('therapy_packages', 'discount_percent', server_default=None)
    op.drop_column('therapy_packages', 'price')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('therapy_packages', sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))

    conn = op.get_bind()
    packages = conn.execute(sa.text("SELECT id, discount_percent FROM therapy_packages")).fetchall()
    for package_id, discount_percent in packages:
        list_price_row = conn.execute(
            sa.text(
                "SELECT COALESCE(SUM(t.price * pi.sessions_included), 0) "
                "FROM package_items pi JOIN therapies t ON t.id = pi.therapy_id "
                "WHERE pi.package_id = :package_id"
            ),
            {"package_id": package_id},
        ).scalar()
        list_price = float(list_price_row or 0)
        price = round(list_price * (1 - float(discount_percent) / 100), 2)
        conn.execute(
            sa.text("UPDATE therapy_packages SET price = :price WHERE id = :package_id"),
            {"price": price, "package_id": package_id},
        )

    op.alter_column('therapy_packages', 'price', server_default=None)
    op.drop_column('therapy_packages', 'discount_percent')
