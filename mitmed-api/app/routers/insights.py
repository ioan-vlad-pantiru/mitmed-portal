from datetime import datetime, timezone
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.database import get_db
from app.deps import require_roles
from app.models import (
    AccountStatus,
    Appointment,
    AppointmentStatus,
    ClientProfile,
    Payment,
    PaymentStatus,
    Role,
    Therapy,
    User,
)

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/therapies")
def get_therapy_insights(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[dict]:
    therapies = db.query(Therapy).order_by(Therapy.name.asc()).all()

    revenue_rows = (
        db.query(Payment.therapy_id, func.sum(Payment.final_price))
        .filter(Payment.status == PaymentStatus.PLATIT)
        .group_by(Payment.therapy_id)
        .all()
    )
    revenue_map = {therapy_id: str(total) for therapy_id, total in revenue_rows}

    sessions_rows = (
        db.query(Appointment.therapy_id, func.count(Appointment.id))
        .filter(Appointment.status == AppointmentStatus.FINALIZATA)
        .group_by(Appointment.therapy_id)
        .all()
    )
    sessions_map = dict(sessions_rows)

    clients_rows = (
        db.query(Payment.therapy_id, Payment.client_id)
        .filter(Payment.status == PaymentStatus.PLATIT)
        .distinct()
        .all()
    )
    clients_count: dict[str, int] = {}
    for therapy_id, _client_id in clients_rows:
        clients_count[therapy_id] = clients_count.get(therapy_id, 0) + 1

    results = [
        {
            "id": t.id,
            "name": t.name,
            "active": t.active,
            "sessions_completed": sessions_map.get(t.id, 0),
            "distinct_clients": clients_count.get(t.id, 0),
            "revenue": revenue_map.get(t.id, "0"),
        }
        for t in therapies
    ]
    results.sort(key=lambda r: float(r["revenue"]), reverse=True)
    return results


@router.get("/overall")
def get_overall_insights(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1)
    month_keys: list[tuple[int, int]] = []
    year, month = now.year, now.month
    for _ in range(6):
        month_keys.append((year, month))
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    month_keys.reverse()
    first_year, first_month = month_keys[0]
    six_months_start = datetime(first_year, first_month, 1, tzinfo=timezone.utc)

    revenue_this_month = (
        db.query(func.coalesce(func.sum(Payment.final_price), 0))
        .filter(Payment.status == PaymentStatus.PLATIT, Payment.paid_at >= month_start)
        .scalar()
    )
    outstanding = (
        db.query(func.coalesce(func.sum(Payment.final_price), 0))
        .filter(Payment.status.in_([PaymentStatus.NEPLATIT, PaymentStatus.PARTIAL]))
        .scalar()
    )
    new_clients_this_month = (
        db.query(ClientProfile).filter(ClientProfile.created_at >= month_start).count()
    )
    completed_this_month = (
        db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.FINALIZATA, Appointment.starts_at >= month_start)
        .count()
    )
    cancelled_this_month = (
        db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.ANULATA, Appointment.starts_at >= month_start)
        .count()
    )
    completed_client_rows = (
        db.query(Appointment.client_id, func.count(Appointment.id))
        .filter(Appointment.status == AppointmentStatus.FINALIZATA)
        .group_by(Appointment.client_id)
        .all()
    )
    returning_clients = sum(1 for _client_id, visits in completed_client_rows if visits >= 2)
    monthly_revenue_map = {f"{year}-{month:02d}": 0.0 for year, month in month_keys}
    paid_rows = (
        db.query(Payment.paid_at, Payment.final_price)
        .filter(Payment.status == PaymentStatus.PLATIT, Payment.paid_at >= six_months_start)
        .all()
    )
    for paid_at, final_price in paid_rows:
        if paid_at:
            key = f"{paid_at.year}-{paid_at.month:02d}"
            if key in monthly_revenue_map:
                monthly_revenue_map[key] += float(final_price)

    return {
        "revenue_this_month": str(revenue_this_month),
        "outstanding": str(outstanding),
        "new_clients_this_month": new_clients_this_month,
        "completed_sessions_this_month": completed_this_month,
        "cancelled_sessions_this_month": cancelled_this_month,
        "returning_clients": returning_clients,
        "clients_with_completed_sessions": len(completed_client_rows),
        "monthly_revenue": [
            {"month": key, "revenue": str(monthly_revenue_map[key])}
            for key in monthly_revenue_map
        ],
    }


@router.get("/outstanding")
def get_outstanding_payments(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[dict]:
    """Detaliu al sumelor neîncasate — cine anume nu a plătit, ca să poată fi
    încasat direct din dashboard-ul de insights, nu doar văzut ca total."""
    payments = (
        db.query(Payment)
        .options(joinedload(Payment.client), joinedload(Payment.therapy))
        .filter(Payment.status.in_([PaymentStatus.NEPLATIT, PaymentStatus.PARTIAL]))
        .order_by(Payment.created_at.asc())
        .all()
    )
    return [
        {
            "id": p.id,
            "client_id": p.client_id,
            "client_name": p.client.full_name,
            "therapy_name": p.therapy.name,
            "final_price": str(p.final_price),
            "status": p.status.value,
            "created_at": p.created_at.isoformat(),
        }
        for p in payments
    ]


def _visible_distribution(values: list[str]) -> list[dict]:
    """Nu arătăm grupe cu sub trei persoane în dashboard-ul intern."""
    counts = Counter(value for value in values if value)
    return [
        {"label": label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if count >= 3
    ]


def _age_group(birth_date: datetime | None) -> str | None:
    if not birth_date:
        return None
    today = datetime.now(timezone.utc).date()
    age = today.year - birth_date.date().year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if age < 18:
        return "Sub 18 ani"
    if age <= 29:
        return "18–29 ani"
    if age <= 44:
        return "30–44 ani"
    if age <= 59:
        return "45–59 ani"
    return "60+ ani"


@router.get("/clients")
def get_client_insights(
    db: DBSession = Depends(get_db), _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    """Profil agregat al clienților; nu returnează niciodată date individuale."""
    clients = db.query(ClientProfile).all()
    profile_data = [client.profile_data or {} for client in clients]
    completed = sum(1 for data in profile_data if data)

    return {
        "total_clients": len(clients),
        "profiles_completed": completed,
        "age_groups": _visible_distribution([group for client in clients if (group := _age_group(client.birth_date))]),
        "cities": _visible_distribution([str(data.get("city", "")) for data in profile_data])[:5],
        "referral_sources": _visible_distribution([str(data.get("referral_source", "")) for data in profile_data]),
        "activity_levels": _visible_distribution([str(data.get("activity_level", "")) for data in profile_data]),
        "primary_goals": _visible_distribution([str(data.get("primary_goal", "")) for data in profile_data]),
        "occupation_categories": _visible_distribution(
            [str(data.get("occupation_category", "")) for data in profile_data]
        ),
    }
