"""The clinic's time zone, in one place.

Forms send times without a zone ("2026-11-13T10:00"); they always mean
wall-clock time at the clinic in Onești, never UTC.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

CLINIC_TIMEZONE = ZoneInfo("Europe/Bucharest")


def to_clinic_time(value: datetime) -> datetime:
    """A naive value is clinic wall-clock time; an aware one is converted."""
    if value.tzinfo is None:
        return value.replace(tzinfo=CLINIC_TIMEZONE)
    return value.astimezone(CLINIC_TIMEZONE)
