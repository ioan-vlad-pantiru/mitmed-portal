from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

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
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

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

    return {
        "revenue_this_month": str(revenue_this_month),
        "outstanding": str(outstanding),
        "new_clients_this_month": new_clients_this_month,
    }
