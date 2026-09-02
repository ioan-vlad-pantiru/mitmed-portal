import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import ClientProfile, Coupon, PaymentStatus, Payment, Role, Therapy, User
from app.services.pricing import CouponError, calculate_price

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentIn(BaseModel):
    client_id: str
    therapy_id: str
    coupon_code: str | None = None
    method: str | None = None
    mark_paid: bool = False


def _find_coupon(db: DBSession, code: str | None) -> Coupon | None:
    if not code:
        return None
    return (
        db.query(Coupon)
        .options(joinedload(Coupon.therapies))
        .filter(Coupon.code == code.strip().upper())
        .first()
    )


@router.post("")
def create_payment(
    payload: PaymentIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    therapy = db.get(Therapy, payload.therapy_id)
    if not therapy:
        raise HTTPException(status_code=422, detail="Terapie invalidă.")

    coupon = _find_coupon(db, payload.coupon_code)
    if payload.coupon_code and not coupon:
        raise HTTPException(status_code=422, detail="Cupon inexistent.")

    try:
        base_price, discount_amount, final_price = calculate_price(therapy, coupon, payload.therapy_id)
    except CouponError as err:
        raise HTTPException(status_code=422, detail=str(err)) from err

    payment = Payment(
        client_id=payload.client_id,
        therapy_id=payload.therapy_id,
        coupon_id=coupon.id if coupon else None,
        base_price=base_price,
        discount_amount=discount_amount,
        final_price=final_price,
        method=payload.method,
        status=PaymentStatus.PLATIT if payload.mark_paid else PaymentStatus.NEPLATIT,
        paid_at=datetime.now(timezone.utc) if payload.mark_paid else None,
        package_total_sessions=therapy.sessions_included if therapy.sessions_included > 1 else None,
    )
    db.add(payment)

    if coupon:
        coupon.uses_count += 1

    db.commit()
    db.refresh(payment)

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.create",
        target_type="Payment",
        target_id=payment.id,
        metadata={"client_id": payload.client_id, "final_price": str(final_price)},
    )
    return {"ok": True, "id": payment.id}


@router.post("/{payment_id}/mark-paid")
def mark_payment_paid(
    payment_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Plată inexistentă.")
    payment.status = PaymentStatus.PLATIT
    payment.paid_at = datetime.now(timezone.utc)
    db.commit()
    log_audit(db, actor_id=actor.id, action="payment.mark_paid", target_type="Payment", target_id=payment_id)
    return {"ok": True}


@router.get("/preview")
def preview_price(
    therapy_id: str,
    coupon_code: str | None = None,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    therapy = db.get(Therapy, therapy_id)
    if not therapy:
        return {"error": "Terapie invalidă."}

    coupon = _find_coupon(db, coupon_code)
    if coupon_code and not coupon:
        return {"error": "Cupon inexistent."}

    try:
        base_price, discount_amount, final_price = calculate_price(therapy, coupon, therapy_id)
    except CouponError as err:
        return {"error": str(err)}

    return {"base_price": str(base_price), "discount_amount": str(discount_amount), "final_price": str(final_price)}


@router.get("/export")
def export_payments_csv(
    start: datetime | None = None,
    end: datetime | None = None,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> StreamingResponse:
    """Export CSV pentru contabilitate — data, client, terapie, sume, status."""
    query = db.query(Payment).options(
        joinedload(Payment.client), joinedload(Payment.therapy), joinedload(Payment.coupon)
    )
    if start:
        query = query.filter(Payment.created_at >= start)
    if end:
        query = query.filter(Payment.created_at <= end)
    payments = query.order_by(Payment.created_at.asc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Data", "Client", "Terapie", "Pret de baza", "Reducere", "Cupon", "Total", "Metoda", "Status", "Platit la"]
    )
    for p in payments:
        writer.writerow(
            [
                p.created_at.strftime("%Y-%m-%d %H:%M"),
                p.client.full_name,
                p.therapy.name,
                p.base_price,
                p.discount_amount,
                p.coupon.code if p.coupon else "",
                p.final_price,
                p.method or "",
                p.status.value,
                p.paid_at.strftime("%Y-%m-%d %H:%M") if p.paid_at else "",
            ]
        )

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plati_mitmed.csv"},
    )
