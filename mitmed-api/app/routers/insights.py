from collections import Counter
from datetime import date as _date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession, joinedload

from app.database import get_db
from app.deps import require_roles
from app.models import ClientProfile, Payment, PaymentStatus, Role, User
from app.services import insights_report

router = APIRouter(prefix="/insights", tags=["insights"])


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
            "amount_paid": str(p.amount_paid),
            "remaining": str(p.final_price - p.amount_paid),
            "paid_via_payu": p.method == "CARD_ONLINE",
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
        "interests": _visible_distribution([str(data.get("interest", "")) for data in profile_data]),
        "occupation_categories": _visible_distribution(
            [str(data.get("occupation_category", "")) for data in profile_data]
        ),
    }


# --- Period report (Zi / Lună / An / Tot) -------------------------------------------


def _parse_anchor(value: str | None) -> _date | None:
    if not value:
        return None
    try:
        return _date.fromisoformat(value[:10])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Dată invalidă.") from exc


@router.get("/report")
def get_report(
    scope: str = Query("month"),
    date: str | None = Query(None),
    db: DBSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Everything the insights page shows for one period, plus the same
    numbers for the period before it so the page can say what got better."""
    return insights_report.build_report(db, scope, _parse_anchor(date))


@router.get("/drilldown")
def get_drilldown(
    metric: str,
    scope: str = Query("month"),
    date: str | None = Query(None),
    start: str | None = Query(None),
    end: str | None = Query(None),
    therapy_id: str | None = None,
    weekday: int | None = None,
    hour: int | None = None,
    method: str | None = None,
    coupon_id: str | None = None,
    db: DBSession = Depends(get_db),
    _user: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    """The individual rows behind any number on the insights page."""
    if start and end:
        try:
            range_start, range_end = datetime.fromisoformat(start), datetime.fromisoformat(end)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Interval invalid.") from exc
    else:
        period = insights_report.resolve_period(db, scope, _parse_anchor(date))
        range_start, range_end = period.start, period.end
    try:
        return insights_report.drilldown(
            db, metric, range_start, range_end, therapy_id=therapy_id, weekday=weekday, hour=hour,
            method=method, coupon_id=coupon_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Indicator necunoscut.") from exc
