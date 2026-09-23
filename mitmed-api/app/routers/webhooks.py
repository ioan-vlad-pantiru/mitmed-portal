"""Endpoint-uri de notificare server-to-server de la procesatori de plăți
externi. Fără autentificare de sesiune — integritatea vine din verificarea
semnăturii proprii a fiecărui provider (vezi services/payu.verify_signature)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Payment, PaymentStatus
from app.services import payu
from app.services.fidelity import register_paid_session

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/payu")
async def payu_notify(request: Request, db: DBSession = Depends(get_db)) -> dict:
    raw_body = await request.body()
    signature_header = request.headers.get("OpenPayU-Signature") or request.headers.get("X-OpenPayU-Signature")
    if not payu.verify_signature(raw_body, signature_header):
        raise HTTPException(status_code=400, detail="Semnătură invalidă.")

    payload = await request.json()
    order = payload.get("order") or {}
    order_status = order.get("status")
    ext_order_id = order.get("extOrderId")
    payu_order_id = order.get("orderId")

    # extOrderId e fie payment.id (plată individuală), fie
    # package_purchase_id (plată de pachet) — vezi crearea comenzii în
    # routers/payments.py. Filtrăm pe status neîncasat, ca o notificare
    # dublată de PayU (retrimit dacă nu răspundem 200 la timp) să nu strice
    # nimic la a doua rulare.
    if order_status == "COMPLETED" and ext_order_id:
        payments = (
            db.query(Payment)
            .filter(
                (Payment.package_purchase_id == ext_order_id) | (Payment.id == ext_order_id),
                Payment.status.in_([PaymentStatus.NEPLATIT, PaymentStatus.PARTIAL]),
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for p in payments:
            p.status = PaymentStatus.PLATIT
            p.paid_at = now
            p.method = "CARD_ONLINE"
            p.payu_order_id = payu_order_id
        db.commit()
        for p in payments:
            register_paid_session(db, p)

    return {"ok": True}
