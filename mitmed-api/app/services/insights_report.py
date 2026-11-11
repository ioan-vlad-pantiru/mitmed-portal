"""Period-based insights report for the admin dashboard.

Everything is computed for a period chosen by the admin (a day, a month, a
year or all time) and compared with the period right before it. When the
chosen period is still running (e.g. the current month), the comparison uses
the same elapsed slice of the previous period, so a half-finished month is
never compared against a full one.

Data volumes for a single clinic are small, so rows are loaded once per period
and aggregated in Python — this keeps the time-zone handling (Europe/Bucharest
days, hours and weekdays) in one obvious place instead of in SQL.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.clinic_time import CLINIC_TIMEZONE
from app.models import (
    Appointment,
    AppointmentStatus,
    BookingRequestStatus,
    ClientProfile,
    Payment,
    PaymentStatus,
    PublicBookingRequest,
    SurveyQuestion,
    SurveyResponse,
    Therapy,
)

SCOPES = ("day", "month", "year", "all")
ACTIVE_STATUSES = (AppointmentStatus.PROGRAMATA, AppointmentStatus.CONFIRMATA)
# A client with at least two visits who has not been back for this long and
# has nothing booked is flagged as "at risk of not returning".
AT_RISK_AFTER_DAYS = 45
AT_RISK_FORGET_AFTER_DAYS = 365

MONTHS_RO = [
    "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
    "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
]
MONTHS_SHORT_RO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"]


def _utc(local: datetime) -> datetime:
    return local.astimezone(timezone.utc)


def _local(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(CLINIC_TIMEZONE)


def _money(value) -> float:
    return round(float(value or 0), 2)


@dataclass
class Period:
    scope: str
    anchor: date
    start: datetime  # UTC, inclusive
    end: datetime  # UTC, exclusive
    prev_start: datetime | None
    prev_end: datetime | None
    label: str
    compare_label: str | None
    is_current: bool
    prev_anchor: date | None
    next_anchor: date | None

    def as_dict(self) -> dict:
        return {
            "scope": self.scope,
            "anchor": self.anchor.isoformat(),
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "prev_start": self.prev_start.isoformat() if self.prev_start else None,
            "prev_end": self.prev_end.isoformat() if self.prev_end else None,
            "label": self.label,
            "compare_label": self.compare_label,
            "is_current": self.is_current,
            "prev_anchor": self.prev_anchor.isoformat() if self.prev_anchor else None,
            "next_anchor": self.next_anchor.isoformat() if self.next_anchor else None,
        }


def _shift_month(d: date, months: int) -> date:
    index = d.year * 12 + (d.month - 1) + months
    return date(index // 12, index % 12 + 1, 1)


def _earliest_activity(db: DBSession) -> datetime | None:
    candidates = [
        db.query(func.min(Appointment.starts_at)).scalar(),
        db.query(func.min(Payment.paid_at)).scalar(),
        db.query(func.min(ClientProfile.created_at)).scalar(),
    ]
    values = [c for c in candidates if c is not None]
    return min(values) if values else None


def resolve_period(db: DBSession, scope: str, anchor: date | None) -> Period:
    now = datetime.now(timezone.utc)
    today = now.astimezone(CLINIC_TIMEZONE).date()
    scope = scope if scope in SCOPES else "month"
    anchor = anchor or today

    if scope == "all":
        earliest = _earliest_activity(db)
        start_local = datetime.combine((_local(earliest).date() if earliest else today), datetime.min.time(), CLINIC_TIMEZONE)
        end_local = datetime.combine(today + timedelta(days=1), datetime.min.time(), CLINIC_TIMEZONE)
        return Period(
            scope="all", anchor=today, start=_utc(start_local), end=_utc(end_local),
            prev_start=None, prev_end=None, label="De la început până azi", compare_label=None,
            is_current=True, prev_anchor=None, next_anchor=None,
        )

    if scope == "day":
        start_d, end_d, prev_d = anchor, anchor + timedelta(days=1), anchor - timedelta(days=1)
        prev_end_d = anchor
        label = f"{anchor.day} {MONTHS_RO[anchor.month - 1]} {anchor.year}"
        if anchor == today:
            label = f"Azi, {label}"
        compare = "față de ziua precedentă"
        next_anchor = end_d
    elif scope == "month":
        start_d = anchor.replace(day=1)
        end_d = _shift_month(start_d, 1)
        prev_d, prev_end_d = _shift_month(start_d, -1), start_d
        label = f"{MONTHS_RO[start_d.month - 1].capitalize()} {start_d.year}"
        compare = "față de luna precedentă"
        next_anchor = end_d
    else:  # year
        start_d = date(anchor.year, 1, 1)
        end_d = date(anchor.year + 1, 1, 1)
        prev_d, prev_end_d = date(anchor.year - 1, 1, 1), start_d
        label = f"Anul {anchor.year}"
        compare = "față de anul precedent"
        next_anchor = end_d

    start = _utc(datetime.combine(start_d, datetime.min.time(), CLINIC_TIMEZONE))
    end = _utc(datetime.combine(end_d, datetime.min.time(), CLINIC_TIMEZONE))
    prev_start = _utc(datetime.combine(prev_d, datetime.min.time(), CLINIC_TIMEZONE))
    prev_end = _utc(datetime.combine(prev_end_d, datetime.min.time(), CLINIC_TIMEZONE))
    is_current = start <= now < end
    if is_current:
        # Compare like with like: only the part of the previous period that
        # had already elapsed at the same point.
        prev_end = min(prev_end, prev_start + (now - start))
        compare = f"{compare}, până în același moment"

    return Period(
        scope=scope, anchor=start_d, start=start, end=end, prev_start=prev_start, prev_end=prev_end,
        label=label, compare_label=compare, is_current=is_current, prev_anchor=prev_d,
        next_anchor=next_anchor if _utc(datetime.combine(next_anchor, datetime.min.time(), CLINIC_TIMEZONE)) <= now else None,
    )


# --- Loading ------------------------------------------------------------------------


def _paid_payments(db: DBSession, start: datetime, end: datetime) -> list[Payment]:
    return (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.therapy), joinedload(Payment.coupon))
        .filter(Payment.amount_paid > 0, Payment.paid_at >= start, Payment.paid_at < end)
        .all()
    )


def _created_payments(db: DBSession, start: datetime, end: datetime) -> list[Payment]:
    return (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.therapy), joinedload(Payment.coupon))
        .filter(Payment.created_at >= start, Payment.created_at < end)
        .all()
    )


def _appointments(db: DBSession, start: datetime, end: datetime) -> list[Appointment]:
    return (
        db.query(Appointment)
        .options(joinedload(Appointment.client), joinedload(Appointment.therapy))
        .filter(Appointment.starts_at >= start, Appointment.starts_at < end)
        .order_by(Appointment.starts_at.asc())
        .all()
    )


def _method_split(p: Payment) -> dict[str, float]:
    """How much of a payment line came in cash, by card at the desk, or online.
    Whatever the cash/card split does not explain is online for PayU lines and
    "unspecified" otherwise (older rows saved before the split existed)."""
    paid = _money(p.amount_paid)
    cash = _money(p.amount_paid_cash)
    card = _money(p.amount_paid_card)
    rest = round(max(0.0, paid - cash - card), 2)
    online = rest if p.method == "CARD_ONLINE" else 0.0
    other = 0.0 if p.method == "CARD_ONLINE" else rest
    return {"cash": cash, "card": card, "online": online, "other": other}


def _rating_ids(db: DBSession) -> set[str]:
    return {q.id for q in db.query(SurveyQuestion).filter(SurveyQuestion.kind == "rating").all()}


def _mean_rating(answers: dict | None, rating_ids: set[str]) -> float | None:
    values = [v for k, v in (answers or {}).items() if k in rating_ids and isinstance(v, int)]
    return sum(values) / len(values) if values else None


def _clients_seen_before(db: DBSession, client_ids: set[str], before: datetime) -> set[str]:
    if not client_ids:
        return set()
    rows = (
        db.query(Appointment.client_id)
        .filter(
            Appointment.client_id.in_(client_ids),
            Appointment.status == AppointmentStatus.FINALIZATA,
            Appointment.starts_at < before,
        )
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


# --- Summary (KPIs) -----------------------------------------------------------------


def summarize(db: DBSession, start: datetime, end: datetime, rating_ids: set[str]) -> dict:
    paid = _paid_payments(db, start, end)
    created = _created_payments(db, start, end)
    appts = _appointments(db, start, end)

    revenue = sum(_money(p.amount_paid) for p in paid)
    completed = [a for a in appts if a.status == AppointmentStatus.FINALIZATA]
    cancelled = [a for a in appts if a.status == AppointmentStatus.ANULATA]
    active_ids = {a.client_id for a in completed}
    returning_ids = _clients_seen_before(db, active_ids, start)
    new_clients = (
        db.query(func.count(ClientProfile.id))
        .filter(ClientProfile.created_at >= start, ClientProfile.created_at < end)
        .scalar()
    )
    responses = (
        db.query(SurveyResponse).filter(SurveyResponse.created_at >= start, SurveyResponse.created_at < end).all()
    )
    ratings = [r for r in (_mean_rating(x.answers, rating_ids) for x in responses) if r is not None]
    requests = (
        db.query(PublicBookingRequest)
        .filter(PublicBookingRequest.created_at >= start, PublicBookingRequest.created_at < end)
        .all()
    )
    finished = len(completed) + len(cancelled)

    return {
        "revenue": round(revenue, 2),
        "sessions": len(completed),
        "cancelled": len(cancelled),
        "cancellation_rate": round(len(cancelled) * 100 / finished, 1) if finished else None,
        "booked_ahead": sum(1 for a in appts if a.status in ACTIVE_STATUSES),
        "avg_per_visit": round(revenue / len(completed), 2) if completed else None,
        "new_clients": int(new_clients or 0),
        "active_clients": len(active_ids),
        "returning_clients": len(returning_ids),
        "first_time_clients": len(active_ids - returning_ids),
        "return_rate": round(len(returning_ids) * 100 / len(active_ids), 1) if active_ids else None,
        "discounts": round(sum(_money(p.discount_amount) for p in created), 2),
        "packages_sold": len({p.package_purchase_id for p in created if p.package_purchase_id}),
        "rating_average": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "rating_count": len(ratings),
        "satisfied_share": round(sum(1 for r in ratings if r >= 4) * 100 / len(ratings)) if ratings else None,
        "booking_requests": len(requests),
        "booking_requests_confirmed": sum(1 for r in requests if r.status == BookingRequestStatus.CONFIRMAT),
    }, paid, created, appts


# --- Time series --------------------------------------------------------------------


def _buckets(period: Period) -> tuple[str, list[dict]]:
    start_local, end_local = _local(period.start), _local(period.end)
    buckets: list[dict] = []
    if period.scope == "day":
        unit = "hour"
        for hour in range(7, 22):
            s = start_local.replace(hour=hour)
            buckets.append({"key": f"{hour:02d}", "label": f"{hour:02d}:00", "start": s, "end": s + timedelta(hours=1)})
    elif period.scope == "month":
        unit = "day"
        d = start_local.date()
        while d < end_local.date():
            s = datetime.combine(d, datetime.min.time(), CLINIC_TIMEZONE)
            buckets.append({
                "key": d.isoformat(), "label": str(d.day), "start": s,
                "end": datetime.combine(d + timedelta(days=1), datetime.min.time(), CLINIC_TIMEZONE),
                "weekend": d.weekday() >= 5,
            })
            d += timedelta(days=1)
    else:
        months = (end_local.year - start_local.year) * 12 + end_local.month - start_local.month + 1
        if period.scope == "all" and months > 36:
            unit = "year"
            for year in range(start_local.year, end_local.year + 1):
                buckets.append({
                    "key": str(year), "label": str(year),
                    "start": datetime(year, 1, 1, tzinfo=CLINIC_TIMEZONE), "end": datetime(year + 1, 1, 1, tzinfo=CLINIC_TIMEZONE),
                })
        else:
            unit = "month"
            d = date(start_local.year, start_local.month, 1)
            while datetime.combine(d, datetime.min.time(), CLINIC_TIMEZONE) < end_local:
                nxt = _shift_month(d, 1)
                label = MONTHS_SHORT_RO[d.month - 1]
                if period.scope == "all":
                    label = f"{label} {str(d.year)[2:]}"
                buckets.append({
                    "key": f"{d.year}-{d.month:02d}", "label": label,
                    "start": datetime.combine(d, datetime.min.time(), CLINIC_TIMEZONE),
                    "end": datetime.combine(nxt, datetime.min.time(), CLINIC_TIMEZONE),
                })
                d = nxt
    return unit, buckets


def _bucket_index(buckets: list[dict], value: datetime | None) -> int | None:
    if value is None:
        return None
    local = _local(value)
    for i, b in enumerate(buckets):
        if b["start"] <= local < b["end"]:
            return i
    return None


def timeseries(period: Period, paid: list[Payment], appts: list[Appointment]) -> dict:
    unit, buckets = _buckets(period)
    rows = [
        {
            "key": b["key"], "label": b["label"], "start": _utc(b["start"]).isoformat(),
            "end": _utc(b["end"]).isoformat(), "weekend": b.get("weekend", False),
            "revenue": 0.0, "sessions": 0, "cancelled": 0, "future": _utc(b["start"]) > datetime.now(timezone.utc),
        }
        for b in buckets
    ]
    for p in paid:
        i = _bucket_index(buckets, p.paid_at)
        if i is not None:
            rows[i]["revenue"] = round(rows[i]["revenue"] + _money(p.amount_paid), 2)
    for a in appts:
        i = _bucket_index(buckets, a.starts_at)
        if i is None:
            continue
        if a.status == AppointmentStatus.FINALIZATA:
            rows[i]["sessions"] += 1
        elif a.status == AppointmentStatus.ANULATA:
            rows[i]["cancelled"] += 1
    return {"unit": unit, "buckets": rows}


# --- Therapies ----------------------------------------------------------------------


def therapy_breakdown(
    db: DBSession, paid: list[Payment], appts: list[Appointment], prev_paid: list[Payment], prev_appts: list[Appointment]
) -> list[dict]:
    stats: dict[str, dict] = defaultdict(lambda: {
        "revenue": 0.0, "sessions": 0, "cancelled": 0, "clients": set(),
        "prev_revenue": 0.0, "prev_sessions": 0,
    })
    for p in paid:
        stats[p.therapy_id]["revenue"] += _money(p.amount_paid)
    for a in appts:
        if a.status == AppointmentStatus.FINALIZATA:
            stats[a.therapy_id]["sessions"] += 1
            stats[a.therapy_id]["clients"].add(a.client_id)
        elif a.status == AppointmentStatus.ANULATA:
            stats[a.therapy_id]["cancelled"] += 1
    for p in prev_paid:
        stats[p.therapy_id]["prev_revenue"] += _money(p.amount_paid)
    for a in prev_appts:
        if a.status == AppointmentStatus.FINALIZATA:
            stats[a.therapy_id]["prev_sessions"] += 1

    therapies = {t.id: t for t in db.query(Therapy).filter(Therapy.id.in_(list(stats.keys()))).all()} if stats else {}
    total = sum(s["revenue"] for s in stats.values()) or 0
    result = []
    for therapy_id, s in stats.items():
        t = therapies.get(therapy_id)
        if not t:
            continue
        finished = s["sessions"] + s["cancelled"]
        result.append({
            "id": therapy_id,
            "name": t.name,
            "active": t.active,
            "revenue": round(s["revenue"], 2),
            "prev_revenue": round(s["prev_revenue"], 2),
            "share": round(s["revenue"] * 100 / total, 1) if total else 0,
            "sessions": s["sessions"],
            "prev_sessions": s["prev_sessions"],
            "cancelled": s["cancelled"],
            "cancellation_rate": round(s["cancelled"] * 100 / finished, 1) if finished else None,
            "clients": len(s["clients"]),
            "avg_per_session": round(s["revenue"] / s["sessions"], 2) if s["sessions"] else None,
        })
    result.sort(key=lambda r: (r["revenue"], r["sessions"]), reverse=True)
    return result


# --- Busy hours ---------------------------------------------------------------------


def heatmap(appts: list[Appointment]) -> dict:
    cells: dict[tuple[int, int], int] = defaultdict(int)
    for a in appts:
        if a.status == AppointmentStatus.ANULATA:
            continue
        local = _local(a.starts_at)
        cells[(local.weekday(), local.hour)] += 1
    hours = sorted({h for _, h in cells}) if cells else []
    hour_range = list(range(min([8, *hours]), max([19, *hours]) + 1))
    by_day = [sum(cells.get((d, h), 0) for h in hour_range) for d in range(7)]
    by_hour = [sum(cells.get((d, h), 0) for d in range(7)) for h in hour_range]
    return {
        "hours": hour_range,
        "cells": [{"weekday": d, "hour": h, "count": c} for (d, h), c in sorted(cells.items())],
        "by_weekday": by_day,
        "by_hour": [{"hour": h, "count": c} for h, c in zip(hour_range, by_hour)],
    }


# --- Snapshot: things that need attention right now ---------------------------------


def _at_risk_clients(db: DBSession) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Appointment.client_id, func.count(Appointment.id), func.max(Appointment.starts_at))
        .filter(Appointment.status == AppointmentStatus.FINALIZATA)
        .group_by(Appointment.client_id)
        .all()
    )
    candidates = {
        client_id: (visits, last)
        for client_id, visits, last in rows
        if visits >= 2
        and timedelta(days=AT_RISK_AFTER_DAYS) <= now - last <= timedelta(days=AT_RISK_FORGET_AFTER_DAYS)
    }
    if not candidates:
        return []
    upcoming = {
        r[0]
        for r in db.query(Appointment.client_id)
        .filter(
            Appointment.client_id.in_(list(candidates)),
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at >= now,
        )
        .distinct()
        .all()
    }
    clients = {c.id: c for c in db.query(ClientProfile).filter(ClientProfile.id.in_(list(candidates))).all()}
    result = [
        {
            "client_id": cid, "client_name": clients[cid].full_name, "phone": clients[cid].phone,
            "visits": visits, "last_visit": last.isoformat(), "days_since": (now - last).days,
        }
        for cid, (visits, last) in candidates.items()
        if cid not in upcoming and cid in clients
    ]
    result.sort(key=lambda r: (-r["visits"], r["days_since"]))
    return result


def _unused_packages(db: DBSession) -> list[dict]:
    now = datetime.now(timezone.utc)
    lines = (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.therapy), joinedload(Payment.package))
        .filter(Payment.package_total_sessions.isnot(None), Payment.sessions_used < Payment.package_total_sessions)
        .all()
    )
    by_client: dict[str, dict] = {}
    for p in lines:
        entry = by_client.setdefault(p.client_id, {
            "client_id": p.client_id, "client_name": p.client.full_name, "phone": p.client.phone,
            "remaining": 0, "items": [], "oldest": p.created_at,
        })
        left = (p.package_total_sessions or 0) - (p.sessions_used or 0)
        entry["remaining"] += left
        entry["items"].append(f"{p.therapy.name}: {left}")
        entry["oldest"] = min(entry["oldest"], p.created_at)
    if not by_client:
        return []
    upcoming = {
        r[0]
        for r in db.query(Appointment.client_id)
        .filter(
            Appointment.client_id.in_(list(by_client)),
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at >= now,
        )
        .distinct()
        .all()
    }
    result = []
    for cid, e in by_client.items():
        result.append({**e, "oldest": e["oldest"].isoformat(), "has_upcoming": cid in upcoming})
    result.sort(key=lambda r: (r["has_upcoming"], -r["remaining"]))
    return result


def _stale_unfinished(db: DBSession) -> list[Appointment]:
    """Appointments whose time has passed but were never marked finished or
    cancelled — the session is not billed, stamped or surveyed until they are."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=3)
    return (
        db.query(Appointment)
        .options(joinedload(Appointment.client), joinedload(Appointment.therapy))
        .filter(Appointment.status.in_(ACTIVE_STATUSES), Appointment.starts_at < cutoff)
        .order_by(Appointment.starts_at.desc())
        .all()
    )


def _outstanding(db: DBSession) -> list[Payment]:
    return (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.therapy))
        .filter(Payment.status.in_([PaymentStatus.NEPLATIT, PaymentStatus.PARTIAL]))
        .order_by(Payment.created_at.asc())
        .all()
    )


def attention(db: DBSession) -> dict:
    now = datetime.now(timezone.utc)
    outstanding = _outstanding(db)
    aging = {"under_30": 0.0, "d30_90": 0.0, "over_90": 0.0}
    for p in outstanding:
        left = _money(Decimal(p.final_price) - Decimal(p.amount_paid))
        age = (now - p.created_at).days
        key = "under_30" if age < 30 else "d30_90" if age <= 90 else "over_90"
        aging[key] = round(aging[key] + left, 2)
    at_risk = _at_risk_clients(db)
    packages = _unused_packages(db)
    return {
        "outstanding_total": round(sum(aging.values()), 2),
        "outstanding_count": len(outstanding),
        "outstanding_clients": len({p.client_id for p in outstanding}),
        "outstanding_aging": aging,
        "at_risk_clients": len(at_risk),
        "unused_packages_clients": len(packages),
        "unused_packages_idle": sum(1 for p in packages if not p["has_upcoming"]),
        "unused_package_sessions": sum(p["remaining"] for p in packages),
        "stale_unfinished": len(_stale_unfinished(db)),
        "pending_booking_requests": db.query(func.count(PublicBookingRequest.id))
        .filter(PublicBookingRequest.status == BookingRequestStatus.NOU)
        .scalar()
        or 0,
    }


# --- Clients & money detail ---------------------------------------------------------


def top_clients(paid: list[Payment], appts: list[Appointment], limit: int = 8) -> list[dict]:
    stats: dict[str, dict] = {}
    for p in paid:
        e = stats.setdefault(p.client_id, {"client_id": p.client_id, "client_name": p.client.full_name, "revenue": 0.0, "visits": 0})
        e["revenue"] = round(e["revenue"] + _money(p.amount_paid), 2)
    for a in appts:
        if a.status == AppointmentStatus.FINALIZATA:
            e = stats.setdefault(a.client_id, {"client_id": a.client_id, "client_name": a.client.full_name, "revenue": 0.0, "visits": 0})
            e["visits"] += 1
    return sorted(stats.values(), key=lambda e: (e["revenue"], e["visits"]), reverse=True)[:limit]


def payment_methods(paid: list[Payment]) -> dict:
    totals = {"cash": 0.0, "card": 0.0, "online": 0.0, "other": 0.0}
    for p in paid:
        for k, v in _method_split(p).items():
            totals[k] = round(totals[k] + v, 2)
    return totals


def coupons_used(created: list[Payment]) -> list[dict]:
    stats: dict[str, dict] = {}
    for p in created:
        if not p.coupon_id or not p.coupon:
            continue
        e = stats.setdefault(p.coupon_id, {"id": p.coupon_id, "code": p.coupon.code, "uses": 0, "discount": 0.0, "revenue": 0.0})
        e["uses"] += 1
        e["discount"] = round(e["discount"] + _money(p.discount_amount), 2)
        e["revenue"] = round(e["revenue"] + _money(p.final_price), 2)
    return sorted(stats.values(), key=lambda e: e["uses"], reverse=True)


def referral_of_new_clients(db: DBSession, start: datetime, end: datetime) -> list[dict]:
    clients = db.query(ClientProfile).filter(ClientProfile.created_at >= start, ClientProfile.created_at < end).all()
    counts: dict[str, int] = defaultdict(int)
    for c in clients:
        counts[str((c.profile_data or {}).get("referral_source") or "NECUNOSCUT")] += 1
    return [{"label": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: -kv[1])]


def build_report(db: DBSession, scope: str, anchor: date | None) -> dict:
    period = resolve_period(db, scope, anchor)
    rating_ids = _rating_ids(db)
    current, paid, created, appts = summarize(db, period.start, period.end, rating_ids)
    if period.prev_start and period.prev_end:
        previous, prev_paid, _prev_created, prev_appts = summarize(db, period.prev_start, period.prev_end, rating_ids)
    else:
        previous, prev_paid, prev_appts = None, [], []

    return {
        "period": period.as_dict(),
        "current": current,
        "previous": previous,
        "series": timeseries(period, paid, appts),
        "therapies": therapy_breakdown(db, paid, appts, prev_paid, prev_appts),
        "heatmap": heatmap(appts),
        "methods": payment_methods(paid),
        "top_clients": top_clients(paid, appts),
        "coupons": coupons_used(created),
        "new_client_sources": referral_of_new_clients(db, period.start, period.end),
        "attention": attention(db),
    }


# --- Drill-down ---------------------------------------------------------------------

STATUS_RO = {
    AppointmentStatus.PROGRAMATA: ("Programată", "info"),
    AppointmentStatus.CONFIRMATA: ("Confirmată", "info"),
    AppointmentStatus.FINALIZATA: ("Finalizată", "success"),
    AppointmentStatus.ANULATA: ("Anulată", "danger"),
}
METHOD_RO = {"cash": "Numerar", "card": "Card la recepție", "online": "Online (PayU)", "other": "Nespecificat"}
SNAPSHOT_METRICS = {"at_risk", "unused_packages", "stale_unfinished", "pending_requests", "outstanding"}
WEEKDAYS_RO = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"]


def _row(*, key: str, client_id: str | None, client_name: str | None, title: str, subtitle: str | None = None,
         when: datetime | None = None, amount: float | None = None, badge: tuple[str, str] | None = None,
         href: str | None = None) -> dict:
    return {
        "key": key,
        "client_id": client_id,
        "client_name": client_name,
        "title": title,
        "subtitle": subtitle,
        "date": when.isoformat() if when else None,
        "amount": amount,
        "badge": {"label": badge[0], "tone": badge[1]} if badge else None,
        "href": href or (f"/admin/clienti/{client_id}" if client_id else None),
    }


def _appt_row(a: Appointment) -> dict:
    return _row(
        key=a.id, client_id=a.client_id, client_name=a.client.full_name, title=a.therapy.name,
        when=a.starts_at, badge=STATUS_RO.get(a.status),
    )


def _payment_row(p: Payment, amount: float | None = None, subtitle: str | None = None) -> dict:
    status = {PaymentStatus.PLATIT: ("Achitat", "success"), PaymentStatus.PARTIAL: ("Parțial", "warning"),
              PaymentStatus.NEPLATIT: ("Neachitat", "danger")}[p.status]
    return _row(
        key=p.id, client_id=p.client_id, client_name=p.client.full_name, title=p.therapy.name,
        subtitle=subtitle, when=p.paid_at or p.created_at,
        amount=_money(p.amount_paid) if amount is None else amount, badge=status,
    )


def drilldown(
    db: DBSession, metric: str, start: datetime, end: datetime, *, therapy_id: str | None = None,
    weekday: int | None = None, hour: int | None = None, method: str | None = None, coupon_id: str | None = None,
) -> list[dict]:
    if metric == "revenue":
        rows = [_payment_row(p) for p in _paid_payments(db, start, end)]
    elif metric == "method":
        rows = []
        for p in _paid_payments(db, start, end):
            part = _method_split(p).get(method or "", 0)
            if part > 0:
                rows.append(_payment_row(p, amount=part))
    elif metric in ("sessions", "cancelled", "booked"):
        wanted = {
            "sessions": (AppointmentStatus.FINALIZATA,),
            "cancelled": (AppointmentStatus.ANULATA,),
            "booked": ACTIVE_STATUSES,
        }[metric]
        rows = [_appt_row(a) for a in _appointments(db, start, end) if a.status in wanted]
    elif metric == "therapy":
        rows = [_appt_row(a) for a in _appointments(db, start, end) if a.therapy_id == therapy_id]
    elif metric == "slot":
        rows = [
            _appt_row(a) for a in _appointments(db, start, end)
            if a.status != AppointmentStatus.ANULATA
            and (weekday is None or _local(a.starts_at).weekday() == weekday)
            and (hour is None or _local(a.starts_at).hour == hour)
        ]
    elif metric == "new_clients":
        clients = (
            db.query(ClientProfile)
            .filter(ClientProfile.created_at >= start, ClientProfile.created_at < end)
            .order_by(ClientProfile.created_at.desc())
            .all()
        )
        rows = [
            _row(key=c.id, client_id=c.id, client_name=c.full_name, title=c.full_name,
                 subtitle=c.phone, when=c.created_at)
            for c in clients
        ]
    elif metric in ("active_clients", "returning_clients", "first_time_clients", "top_clients"):
        appts = [a for a in _appointments(db, start, end) if a.status == AppointmentStatus.FINALIZATA]
        visits: dict[str, list[Appointment]] = defaultdict(list)
        for a in appts:
            visits[a.client_id].append(a)
        revenue: dict[str, float] = defaultdict(float)
        names: dict[str, str] = {}
        for p in _paid_payments(db, start, end):
            revenue[p.client_id] += _money(p.amount_paid)
            names[p.client_id] = p.client.full_name
        ids = set(visits) | (set(revenue) if metric == "top_clients" else set())
        seen = _clients_seen_before(db, set(visits), start)
        if metric == "returning_clients":
            ids = {i for i in ids if i in seen}
        elif metric == "first_time_clients":
            ids = {i for i in ids if i not in seen}
        rows = []
        for cid in ids:
            name = visits[cid][0].client.full_name if visits.get(cid) else names.get(cid, "—")
            count = len(visits.get(cid, []))
            rows.append(_row(
                key=cid, client_id=cid, client_name=name, title=name,
                subtitle=f"{count} {'vizită' if count == 1 else 'vizite'} în perioadă",
                when=max((a.starts_at for a in visits.get(cid, [])), default=None),
                amount=round(revenue.get(cid, 0), 2),
                badge=("Revine", "success") if cid in seen else ("Prima perioadă", "info"),
            ))
        rows.sort(key=lambda r: (r["amount"] or 0), reverse=True)
        return rows
    elif metric == "discounts":
        rows = []
        for p in _created_payments(db, start, end):
            d = _money(p.discount_amount)
            if d <= 0:
                continue
            source = (f"Cupon {p.coupon.code}" if p.coupon else "Pachet" if p.package_id
                      else "Card de fidelitate" if p.fidelity_card_id else "Reducere")
            rows.append(_row(key=p.id, client_id=p.client_id, client_name=p.client.full_name,
                             title=p.therapy.name, subtitle=f"{source} · din {_money(p.base_price):g} RON",
                             when=p.created_at, amount=d))
    elif metric == "coupon":
        rows = [
            _row(key=p.id, client_id=p.client_id, client_name=p.client.full_name, title=p.therapy.name,
                 subtitle=f"Reducere {_money(p.discount_amount):g} RON", when=p.created_at, amount=_money(p.final_price))
            for p in _created_payments(db, start, end) if p.coupon_id == coupon_id
        ]
    elif metric == "packages_sold":
        groups: dict[str, list[Payment]] = defaultdict(list)
        for p in _created_payments(db, start, end):
            if p.package_purchase_id:
                groups[p.package_purchase_id].append(p)
        rows = []
        for pid, lines in groups.items():
            first = lines[0]
            name = first.package.name if first.package else "Pachet"
            rows.append(_row(
                key=pid, client_id=first.client_id, client_name=first.client.full_name, title=name,
                subtitle=", ".join(f"{p.therapy.name} ×{p.package_total_sessions or 1}" for p in lines),
                when=first.created_at, amount=round(sum(_money(p.final_price) for p in lines), 2),
            ))
    elif metric == "ratings":
        rating_ids = _rating_ids(db)
        responses = (
            db.query(SurveyResponse)
            .options(joinedload(SurveyResponse.client), joinedload(SurveyResponse.appointment).joinedload(Appointment.therapy))
            .filter(SurveyResponse.created_at >= start, SurveyResponse.created_at < end)
            .order_by(SurveyResponse.created_at.desc())
            .all()
        )
        rows = []
        for r in responses:
            score = _mean_rating(r.answers, rating_ids)
            tone = "success" if score and score >= 4 else "warning" if score and score >= 3 else "danger"
            rows.append(_row(
                key=r.id, client_id=r.client_id, client_name=r.client.full_name,
                title=r.appointment.therapy.name if r.appointment else "Sondaj",
                when=r.created_at, badge=(f"{score:.1f} / 5", tone) if score is not None else None,
                href="/admin/sondaj",
            ))
    elif metric == "booking_requests":
        reqs = (
            db.query(PublicBookingRequest)
            .options(joinedload(PublicBookingRequest.therapy))
            .filter(PublicBookingRequest.created_at >= start, PublicBookingRequest.created_at < end)
            .order_by(PublicBookingRequest.created_at.desc())
            .all()
        )
        tones = {BookingRequestStatus.NOU: ("Nouă", "warning"), BookingRequestStatus.CONFIRMAT: ("Confirmată", "success"),
                 BookingRequestStatus.RESPINS: ("Respinsă", "neutral")}
        rows = [
            _row(key=r.id, client_id=None, client_name=r.full_name, title=r.full_name,
                 subtitle=" · ".join(x for x in [r.therapy.name if r.therapy else None, r.phone] if x),
                 when=r.created_at, badge=tones[r.status], href="/admin/cereri")
            for r in reqs
        ]
    # Snapshot lists (ignore the period).
    elif metric == "at_risk":
        rows = [
            _row(key=c["client_id"], client_id=c["client_id"], client_name=c["client_name"], title=c["client_name"],
                 subtitle=f"{c['visits']} vizite · ultima acum {c['days_since']} zile" + (f" · {c['phone']}" if c["phone"] else ""),
                 when=datetime.fromisoformat(c["last_visit"]),
                 badge=("Nu a revenit", "warning"))
            for c in _at_risk_clients(db)
        ]
    elif metric == "unused_packages":
        rows = [
            _row(key=c["client_id"], client_id=c["client_id"], client_name=c["client_name"], title=c["client_name"],
                 subtitle=" · ".join(c["items"]) + (f" · {c['phone']}" if c["phone"] else ""),
                 when=datetime.fromisoformat(c["oldest"]),
                 badge=(f"{c['remaining']} ședințe rămase", "success" if c["has_upcoming"] else "warning"))
            for c in _unused_packages(db)
        ]
    elif metric == "stale_unfinished":
        rows = [
            {**_appt_row(a), "href": f"/admin/consult/{a.id}", "badge": {"label": "Nefinalizată", "tone": "warning"}}
            for a in _stale_unfinished(db)
        ]
    elif metric == "pending_requests":
        reqs = (
            db.query(PublicBookingRequest)
            .options(joinedload(PublicBookingRequest.therapy))
            .filter(PublicBookingRequest.status == BookingRequestStatus.NOU)
            .order_by(PublicBookingRequest.created_at.asc())
            .all()
        )
        rows = [
            _row(key=r.id, client_id=None, client_name=r.full_name, title=r.full_name,
                 subtitle=" · ".join(x for x in [r.therapy.name if r.therapy else None, r.phone] if x),
                 when=r.created_at, badge=("Nouă", "warning"), href="/admin/cereri")
            for r in reqs
        ]
    elif metric == "outstanding":
        rows = []
        for p in _outstanding(db):
            left = _money(Decimal(p.final_price) - Decimal(p.amount_paid))
            age = (datetime.now(timezone.utc) - p.created_at).days
            rows.append(_row(key=p.id, client_id=p.client_id, client_name=p.client.full_name, title=p.therapy.name,
                             subtitle=f"de {age} zile" + (f" · {p.client.phone}" if p.client.phone else ""),
                             when=p.created_at, amount=left,
                             badge=("Parțial", "warning") if p.status == PaymentStatus.PARTIAL else ("Neachitat", "danger")))
    else:
        raise ValueError(metric)

    # Snapshot lists keep their own priority order; period lists go newest first.
    if metric not in SNAPSHOT_METRICS:
        rows.sort(key=lambda r: r["date"] or "", reverse=True)
    return rows
