"""appointment times: reinterpret stored wall-clock times as Bucharest time

Revision ID: c3d9e1f2a4b6
Revises: 7b2d4f6a8c10
Create Date: 2026-11-11 20:00:00.000000

Booking forms send "YYYY-MM-DDTHH:MM" without a zone. Until now the API saved
that value as-is, so Postgres stored the clinic's wall-clock time *as UTC*
(a 10:00 visit was saved as 10:00Z = 12:00 in Bucharest). The portal ran in
UTC, which hid the error on screen, but reminders and availability checks
were off by 2-3 hours. The API now stores these times in the clinic zone;
this migration moves every existing row onto the same footing.

Checked on production before writing this (2026-11-11): all 46 appointments
fall between 10:00 and 17:00 "UTC", i.e. exactly the clinic's opening hours
read as wall-clock — none were stored correctly, so every row is shifted.
Public booking requests are left alone: the site widget sends real UTC
instants (they sit at 07:00-11:00Z = 09:00-13:00 local), so they were right.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c3d9e1f2a4b6"
down_revision: Union[str, Sequence[str], None] = "7b2d4f6a8c10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # (ts AT TIME ZONE 'UTC') gives the stored wall-clock; AT TIME ZONE
    # 'Europe/Bucharest' turns that wall-clock back into the right instant
    # (DST-aware, so summer and winter dates both land correctly).
    op.execute(
        "UPDATE appointments SET starts_at = (starts_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Bucharest'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE appointments SET starts_at = (starts_at AT TIME ZONE 'Europe/Bucharest') AT TIME ZONE 'UTC'"
    )
