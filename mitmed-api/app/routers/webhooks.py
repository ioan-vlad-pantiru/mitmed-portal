"""Endpoint-uri de notificare server-to-server de la procesatori de plăți
externi. Fără autentificare de sesiune — integritatea vine din verificarea
semnăturii proprii a fiecărui provider (vezi services/payu.verify_signature)."""

import hashlib
import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.database import get_db
from app.models import Payment, PaymentStatus
from app.services import payu
from app.services.fidelity import register_paid_session

logger = logging.getLogger("mitmed.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp", response_class=PlainTextResponse)
def whatsapp_verify(
    mode: str | None = Query(default=None, alias="hub.mode"),
    token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> str:
    """Handshake-ul Meta la salvarea webhook-ului: returnăm `hub.challenge`
    doar dacă tokenul coincide cu cel configurat de noi."""
    expected = settings.whatsapp_verify_token
    if not expected or mode != "subscribe" or not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Token invalid.")
    return challenge or ""


@router.post("/whatsapp")
async def whatsapp_notify(request: Request) -> dict:
    raw_body = await request.body()
    secret = settings.whatsapp_app_secret
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not secret:
        raise HTTPException(status_code=403, detail="Webhook neconfigurat.")
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=403, detail="Semnătură invalidă.")

    payload = await request.json()
    # Doar statusuri de livrare și numărul de mesaje primite — fără conținut
    # sau numere de telefon în loguri (date personale).
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for status in value.get("statuses", []):
                logger.info("WhatsApp status %s pentru mesajul %s", status.get("status"), status.get("id"))
            if value.get("messages"):
                logger.info("WhatsApp: %d mesaje primite", len(value["messages"]))
    return {"ok": True}


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
            # Comanda PayU a fost inițiată exact pentru restul de plată (vezi
            # create_payu_checkout) — confirmarea ei stinge tot ce mai rămăsese,
            # indiferent dacă linia era neatinsă sau deja parțial achitată.
            p.amount_paid = p.final_price
            p.status = PaymentStatus.PLATIT
            p.paid_at = now
            p.method = "CARD_ONLINE"
            p.payu_order_id = payu_order_id
        db.commit()
        for p in payments:
            register_paid_session(db, p)

    return {"ok": True}
