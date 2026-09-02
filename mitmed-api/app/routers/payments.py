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
from app.models import ClientProfile, Coupon, PackageItem, PaymentStatus, Payment, Role, Therapy, TherapyPackage, User, gen_id
from app.services.pricing import CouponError, calculate_price

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentIn(BaseModel):
    client_id: str
    # Exact unul dintre therapy_id/package_id trebuie completat — o plată e
    # fie pentru o terapie individuală, fie pentru un pachet întreg.
    therapy_id: str | None = None
    package_id: str | None = None
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


def _create_package_payments(
    db: DBSession, *, client_id: str, package: TherapyPackage, method: str | None, mark_paid: bool
) -> list[Payment]:
    """O achiziție de pachet = câte un Payment per terapie inclusă, toate cu
    același package_purchase_id (grupare în UI) — nu o entitate de plată nouă,
    ca services/packages.consume_package_session și atribuirea veniturilor pe
    terapie din /insights să funcționeze neschimbate peste rândurile rezultate."""
    if not package.active:
        raise HTTPException(status_code=422, detail="Acest pachet nu mai este disponibil.")
    if not package.items:
        raise HTTPException(status_code=422, detail="Pachetul nu are nicio terapie inclusă.")

    # Prețul fix al pachetului se împarte proporțional cu "valoarea" fiecărei
    # terapii incluse (preț de listă × nr. ședințe), ca fiecare Payment rezultat
    # să aibă un final_price plauzibil — relevant pentru /insights (venit pe
    # terapie) și pentru export-ul CSV de contabilitate.
    weights = [(item, float(item.therapy.price) * item.sessions_included) for item in package.items]
    total_weight = sum(w for _, w in weights) or 1

    purchase_id = gen_id()
    status = PaymentStatus.PLATIT if mark_paid else PaymentStatus.NEPLATIT
    paid_at = datetime.now(timezone.utc) if mark_paid else None

    payments: list[Payment] = []
    allocated = 0.0
    for idx, (item, weight) in enumerate(weights):
        is_last = idx == len(weights) - 1
        # Restul (nu proporția) pe ultima linie, ca suma exactă a rândurilor
        # să dea mereu package.price, indiferent de rotunjiri.
        share = float(package.price) - allocated if is_last else round(float(package.price) * weight / total_weight, 2)
        allocated += share

        payments.append(
            Payment(
                client_id=client_id,
                therapy_id=item.therapy_id,
                package_id=package.id,
                package_purchase_id=purchase_id,
                base_price=share,
                discount_amount=0,
                final_price=share,
                method=method,
                status=status,
                paid_at=paid_at,
                package_total_sessions=item.sessions_included,
            )
        )
    db.add_all(payments)
    return payments


@router.post("")
def create_payment(
    payload: PaymentIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    if bool(payload.therapy_id) == bool(payload.package_id):
        raise HTTPException(status_code=422, detail="Alege fie o terapie, fie un pachet — nu ambele sau niciuna.")

    if payload.package_id:
        package = (
            db.query(TherapyPackage)
            .options(joinedload(TherapyPackage.items).joinedload(PackageItem.therapy))
            .filter(TherapyPackage.id == payload.package_id)
            .first()
        )
        if not package:
            raise HTTPException(status_code=422, detail="Pachet invalid.")
        payments = _create_package_payments(
            db, client_id=payload.client_id, package=package, method=payload.method, mark_paid=payload.mark_paid
        )
        db.commit()
        for p in payments:
            db.refresh(p)
        log_audit(
            db,
            actor_id=actor.id,
            action="payment.create_package",
            target_type="Payment",
            target_id=payments[0].package_purchase_id,
            metadata={"client_id": payload.client_id, "package_id": package.id},
        )
        return {"ok": True, "ids": [p.id for p in payments]}

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

    # O terapie cumpărată individual e mereu o ședință unică — package_total_sessions
    # rămâne null. Orice "cumpăr N ședințe" trece prin /admin/pachete (vezi
    # _create_package_payments mai sus), care setează explicit acest câmp.
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
