import csv
import io
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.config import settings
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import (
    Appointment,
    AppointmentStatus,
    ClientProfile,
    Coupon,
    PackageItem,
    PaymentStatus,
    Payment,
    Role,
    Therapy,
    TherapyPackage,
    User,
    gen_id,
)
from app.services import payu
from app.services.fidelity import find_active_card, next_session_discount_percent, register_paid_session, unregister_paid_session
from app.services.pricing import CouponError, calculate_price, round_money

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentIn(BaseModel):
    client_id: str
    # Exact unul dintre therapy_id/package_id trebuie completat — o plată e
    # fie pentru o terapie individuală, fie pentru un pachet întreg.
    therapy_id: str | None = None
    package_id: str | None = None
    coupon_code: str | None = None
    method: str | None = None
    # Cât se încasează chiar acum, la creare — None/0 înseamnă neîncasat încă.
    # O sumă sub prețul final înseamnă plată parțială (status PARTIAL); restul
    # se poate încasa mai târziu prin /mark-paid sau online (PayU).
    amount_paid: float | None = Field(default=None, ge=0)


class PaymentLineIn(BaseModel):
    therapy_id: str
    # Programarea pe care o acoperă linia, dacă e cazul — dacă programarea are
    # deja o plată neîncasată (generată la rezervarea online), linia o
    # recalculează pe aceea în loc să creeze una nouă.
    appointment_id: str | None = None


class MultiPaymentIn(BaseModel):
    client_id: str
    lines: list[PaymentLineIn] = Field(min_length=1, max_length=30)
    coupon_code: str | None = None
    method: str | None = None
    # Suma încasată acum pentru TOATE liniile — se repartizează pe linii în
    # ordine (fiecare achitată integral înainte de următoarea), ca ștampilele
    # de fidelitate să avanseze în aceeași ordine în care s-au calculat.
    amount_paid: float | None = Field(default=None, ge=0)


class MarkPaidIn(BaseModel):
    # None înseamnă "încasează tot restul" (comportamentul vechi, cel mai
    # comun caz din UI — un singur buton "Marchează plătit"). O sumă explicită
    # înregistrează o încasare parțială suplimentară, peste ce era deja plătit.
    amount: float | None = Field(default=None, gt=0)
    # Variantă mixtă — încasarea se împarte explicit parte numerar/parte card
    # (ex. clientul plătește diferența în două metode la recepție). Exclusiv
    # cu `amount`; suma lor ia locul lui `amount` mai jos. Cel puțin una
    # dintre cele două trebuie să fie pozitivă.
    cash_amount: float | None = Field(default=None, ge=0)
    card_amount: float | None = Field(default=None, ge=0)


class CorrectAmountPaidIn(BaseModel):
    # Nu se ADAUGĂ, ca la /mark-paid — înlocuiește direct suma încasată
    # (0 = "de fapt n-a fost plătit, anulează încasarea"). Pentru corectarea
    # unei greșeli de la recepție (sumă greșită, click din greșeală), nu
    # pentru rambursări reale de card — vezi verificarea method=="CARD_ONLINE" mai jos.
    amount_paid: float = Field(ge=0)


def _resolve_mark_paid_amount(payload: MarkPaidIn | None) -> tuple[Decimal | None, Decimal, Decimal, str | None]:
    """Interpretează MarkPaidIn: fie o sumă unică (comportamentul clasic —
    returnează doar suma, fără metodă), fie o împărțire cash_amount/card_amount
    (returnează suma lor + cele două componente + metoda rezultată: 'numerar',
    'card' sau 'MIXED' când ambele sunt pozitive). Cele două forme sunt exclusive."""
    if not payload:
        return None, Decimal("0"), Decimal("0"), None
    has_split = payload.cash_amount is not None or payload.card_amount is not None
    if payload.amount is not None and has_split:
        raise HTTPException(status_code=422, detail="Alege fie o sumă unică, fie o împărțire numerar/card — nu ambele.")
    if has_split:
        cash = Decimal(str(payload.cash_amount or 0))
        card = Decimal(str(payload.card_amount or 0))
        total = cash + card
        if total <= 0:
            raise HTTPException(status_code=422, detail="Suma încasată trebuie să fie pozitivă.")
        method = "MIXED" if cash > 0 and card > 0 else ("card" if card > 0 else "numerar")
        return total, cash, card, method
    amount = Decimal(str(payload.amount)) if payload.amount is not None else None
    return amount, Decimal("0"), Decimal("0"), None


def _status_for_amount(amount_paid: Decimal, final_price: Decimal) -> PaymentStatus:
    if amount_paid <= 0:
        return PaymentStatus.NEPLATIT
    if amount_paid >= final_price:
        return PaymentStatus.PLATIT
    return PaymentStatus.PARTIAL


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
    db: DBSession, *, client_id: str, package: TherapyPackage, method: str | None, amount_paid: float | None
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
    # terapie) și pentru export-ul CSV de contabilitate. O plată parțială la
    # cumpărare se împarte cu aceleași ponderi, ca fiecare linie să rămână
    # proporțional achitată — nu doar prima linie plătită integral și restul deloc.
    weights = [(item, float(item.therapy.price) * item.sessions_included) for item in package.items]
    total_weight = sum(w for _, w in weights) or 1

    purchase_id = gen_id()
    total_price = float(package.price)
    requested_paid = min(max(amount_paid or 0, 0), total_price)
    now = datetime.now(timezone.utc) if requested_paid > 0 else None

    payments: list[Payment] = []
    allocated_price = 0.0
    allocated_paid = 0.0
    for idx, (item, weight) in enumerate(weights):
        is_last = idx == len(weights) - 1
        # Restul (nu proporția) pe ultima linie, ca suma exactă a rândurilor
        # să dea mereu package.price/suma încasată, indiferent de rotunjiri.
        share = total_price - allocated_price if is_last else round(total_price * weight / total_weight, 2)
        allocated_price += share
        paid_share = requested_paid - allocated_paid if is_last else round(requested_paid * weight / total_weight, 2)
        allocated_paid += paid_share

        payments.append(
            Payment(
                client_id=client_id,
                therapy_id=item.therapy_id,
                package_id=package.id,
                package_purchase_id=purchase_id,
                base_price=share,
                discount_amount=0,
                final_price=share,
                amount_paid=paid_share,
                method=method,
                status=_status_for_amount(Decimal(str(paid_share)), Decimal(str(share))),
                paid_at=now if paid_share > 0 else None,
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
            db, client_id=payload.client_id, package=package, method=payload.method, amount_paid=payload.amount_paid
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

    # Reducerea de fidelitate e complet automată — se aplică singură când
    # clientul are un card activ pentru terapia aleasă și poziția curentă în
    # ciclu are o treaptă cu reducere (vezi services/fidelity.py). Un cupon
    # ales explicit de personal are prioritate — cele două nu se cumulează.
    fidelity_card = None if coupon else find_active_card(db, client_id=payload.client_id, therapy_id=payload.therapy_id)
    fidelity_discount = next_session_discount_percent(fidelity_card) if fidelity_card else None

    if fidelity_discount is not None:
        base_price = Decimal(therapy.price)
        discount_amount = round_money(base_price * fidelity_discount / Decimal(100))
        final_price = base_price - discount_amount
    else:
        fidelity_card = None
        try:
            base_price, discount_amount, final_price = calculate_price(therapy, coupon, payload.therapy_id)
        except CouponError as err:
            raise HTTPException(status_code=422, detail=str(err)) from err

    amount_paid = Decimal(str(min(max(payload.amount_paid or 0, 0), float(final_price))))
    status = _status_for_amount(amount_paid, final_price)

    # O terapie cumpărată individual e mereu o ședință unică — package_total_sessions
    # rămâne null. Orice "cumpăr N ședințe" trece prin /admin/pachete (vezi
    # _create_package_payments mai sus), care setează explicit acest câmp.
    payment = Payment(
        client_id=payload.client_id,
        therapy_id=payload.therapy_id,
        coupon_id=coupon.id if coupon else None,
        fidelity_card_id=fidelity_card.id if fidelity_card else None,
        base_price=base_price,
        discount_amount=discount_amount,
        final_price=final_price,
        amount_paid=amount_paid,
        method=payload.method,
        status=status,
        paid_at=datetime.now(timezone.utc) if amount_paid > 0 else None,
    )
    db.add(payment)

    if coupon:
        coupon.uses_count += 1

    db.commit()
    db.refresh(payment)

    # Ștampila de fidelitate contează doar o ședință achitată INTEGRAL — o
    # plată parțială nu contribuie încă la programul de reduceri.
    if status == PaymentStatus.PLATIT:
        register_paid_session(db, payment)

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.create",
        target_type="Payment",
        target_id=payment.id,
        metadata={"client_id": payload.client_id, "final_price": str(final_price)},
    )
    return {"ok": True, "id": payment.id}


def _has_active_package(db: DBSession, *, client_id: str, therapy_id: str) -> bool:
    return (
        db.query(Payment.id)
        .filter(
            Payment.client_id == client_id,
            Payment.therapy_id == therapy_id,
            Payment.package_total_sessions.is_not(None),
            Payment.sessions_used < Payment.package_total_sessions,
        )
        .first()
        is not None
    )


def _price_lines(db: DBSession, payload: MultiPaymentIn) -> tuple[list[dict], Coupon | None]:
    """Prețul fiecărei linii dintr-o plată cu mai multe terapii, în ordine.

    Reducerea de fidelitate se calculează ca și cum liniile ar fi ședințe
    plătite una după alta: fiecare linie pe același card (din oricare terapie
    a lui) e cu o poziție mai departe în ciclu. Un cupon se aplică liniilor pentru care e
    valabil (fără să se cumuleze cu fidelitatea pe aceeași linie) și consumă
    câte o utilizare per linie."""
    client = db.get(ClientProfile, payload.client_id)
    if not client:
        raise HTTPException(status_code=422, detail="Client inexistent.")
    coupon = _find_coupon(db, payload.coupon_code)
    if payload.coupon_code and not coupon:
        raise HTTPException(status_code=422, detail="Cupon inexistent.")

    appointment_ids = [line.appointment_id for line in payload.lines if line.appointment_id]
    if len(appointment_ids) != len(set(appointment_ids)):
        raise HTTPException(status_code=422, detail="O programare apare de două ori în aceeași plată.")

    ahead: dict[str, int] = {}
    coupon_uses = 0
    coupon_error: str | None = None
    priced: list[dict] = []
    for line in payload.lines:
        therapy = db.get(Therapy, line.therapy_id)
        if not therapy:
            raise HTTPException(status_code=422, detail="Terapie invalidă.")
        appointment = None
        existing = None
        if line.appointment_id:
            appointment = db.get(Appointment, line.appointment_id)
            if not appointment or appointment.client_id != payload.client_id:
                raise HTTPException(status_code=422, detail="Programare invalidă.")
            if appointment.status == AppointmentStatus.ANULATA:
                raise HTTPException(status_code=422, detail="O programare anulată nu se mai poate plăti.")
            if appointment.therapy_id != line.therapy_id:
                raise HTTPException(status_code=422, detail="Terapia liniei nu corespunde programării.")
            existing = db.query(Payment).filter(Payment.appointment_id == appointment.id).first()
            # O programare acoperită de un pachet activ se scade din pachet la
            # consult — nu se plătește separat și nu contează la fidelitate.
            if not existing and _has_active_package(db, client_id=payload.client_id, therapy_id=therapy.id):
                raise HTTPException(
                    status_code=422,
                    detail=f"Programarea de {therapy.name} se scade din pachetul activ al clientului — nu se plătește "
                    "separat și nu contează la cardul de fidelitate.",
                )
            if existing and (existing.status != PaymentStatus.NEPLATIT or existing.package_total_sessions is not None):
                raise HTTPException(
                    status_code=422,
                    detail=f"Programarea de {therapy.name} are deja o plată încasată — vezi lista de plăți.",
                )

        base_price = Decimal(therapy.price)
        discount_amount = Decimal(0)
        fidelity_card = None
        fidelity_percent = None
        coupon_applied = False

        if coupon:
            if coupon.max_uses is not None and coupon.uses_count + coupon_uses >= coupon.max_uses:
                coupon_error = "Cuponul nu mai are destule utilizări pentru toate terapiile."
            else:
                try:
                    base_price, discount_amount, _ = calculate_price(therapy, coupon, therapy.id)
                    coupon_applied = True
                    coupon_uses += 1
                except CouponError as err:
                    coupon_error = str(err)
        if not coupon_applied:
            fidelity_card = find_active_card(db, client_id=payload.client_id, therapy_id=therapy.id)
            if fidelity_card:
                # Contorul e comun tuturor terapiilor cardului — orice linie
                # anterioară pe același card împinge poziția mai departe.
                fidelity_percent = next_session_discount_percent(fidelity_card, ahead=ahead.get(fidelity_card.id, 0))
                ahead[fidelity_card.id] = ahead.get(fidelity_card.id, 0) + 1
                if fidelity_percent is not None:
                    discount_amount = round_money(base_price * fidelity_percent / Decimal(100))
                else:
                    fidelity_card = None

        priced.append(
            {
                "therapy": therapy,
                "appointment": appointment,
                "existing": existing,
                "base_price": base_price,
                "discount_amount": discount_amount,
                "final_price": base_price - discount_amount,
                "coupon": coupon if coupon_applied else None,
                "fidelity_card": fidelity_card,
                "fidelity_percent": fidelity_percent,
            }
        )

    if coupon and coupon_uses == 0:
        raise HTTPException(status_code=422, detail=coupon_error or "Cuponul nu se aplică niciunei terapii.")
    return priced, coupon


def _line_out(line: dict) -> dict:
    appointment = line["appointment"]
    return {
        "therapy_id": line["therapy"].id,
        "therapy_name": line["therapy"].name,
        "appointment_id": appointment.id if appointment else None,
        "appointment_starts_at": appointment.starts_at if appointment else None,
        "base_price": str(line["base_price"]),
        "discount_amount": str(line["discount_amount"]),
        "final_price": str(line["final_price"]),
        "coupon_code": line["coupon"].code if line["coupon"] else None,
        "fidelity_card_name": line["fidelity_card"].card_type.name if line["fidelity_card"] else None,
        "fidelity_discount_percent": str(line["fidelity_percent"]) if line["fidelity_card"] else None,
    }


def _totals(priced: list[dict]) -> dict:
    return {
        "base_price": str(sum((p["base_price"] for p in priced), Decimal(0))),
        "discount_amount": str(sum((p["discount_amount"] for p in priced), Decimal(0))),
        "final_price": str(sum((p["final_price"] for p in priced), Decimal(0))),
    }


@router.post("/multi/preview")
def preview_multi_payment(
    payload: MultiPaymentIn, db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    priced, _ = _price_lines(db, payload)
    return {"lines": [_line_out(p) for p in priced], **_totals(priced)}


@router.post("/multi")
def create_multi_payment(
    payload: MultiPaymentIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    """O plată pentru mai multe terapii odată (cu sau fără programările lor).
    Fiecare linie devine un Payment separat — ca istoricul, fidelitatea,
    exportul și /insights să funcționeze ca la plățile individuale."""
    priced, coupon = _price_lines(db, payload)
    remaining = Decimal(str(payload.amount_paid or 0))
    now = datetime.now(timezone.utc)
    payments: list[Payment] = []
    for line in priced:
        final_price = line["final_price"]
        amount_paid = min(remaining, final_price)
        remaining -= amount_paid
        payment = line["existing"] or Payment(client_id=payload.client_id, therapy_id=line["therapy"].id)
        if not line["existing"]:
            db.add(payment)
        payment.appointment_id = line["appointment"].id if line["appointment"] else None
        payment.coupon_id = line["coupon"].id if line["coupon"] else None
        payment.fidelity_card_id = line["fidelity_card"].id if line["fidelity_card"] else None
        payment.base_price = line["base_price"]
        payment.discount_amount = line["discount_amount"]
        payment.final_price = final_price
        payment.amount_paid = amount_paid
        payment.method = payload.method
        payment.status = _status_for_amount(amount_paid, final_price)
        payment.paid_at = now if amount_paid > 0 else None
        payments.append(payment)
    if coupon:
        coupon.uses_count += sum(1 for line in priced if line["coupon"])
    db.commit()

    # Ștampilele în ordinea liniilor — aceeași ordine în care s-au calculat
    # reducerile de fidelitate mai sus.
    for payment in payments:
        db.refresh(payment)
        if payment.status == PaymentStatus.PLATIT:
            register_paid_session(db, payment)

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.create_multi",
        target_type="Payment",
        target_id=payments[0].id,
        metadata={"client_id": payload.client_id, "payment_ids": [p.id for p in payments], **_totals(priced)},
    )
    return {"ok": True, "ids": [p.id for p in payments], **_totals(priced)}


@router.post("/{payment_id}/mark-paid")
def mark_payment_paid(
    payment_id: str,
    payload: MarkPaidIn | None = None,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Înregistrează o încasare — implicit tot restul (un singur buton
    "Marchează plătit"), sau doar o sumă explicită (plată parțială/încasare
    suplimentară peste una parțială deja existentă). Nu poate depăși restul
    de plată; nu poate fi apelat pe o plată deja achitată integral."""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Plată inexistentă.")
    if payment.status == PaymentStatus.PLATIT:
        raise HTTPException(status_code=422, detail="Această plată a fost deja achitată integral.")

    remaining = Decimal(payment.final_price) - Decimal(payment.amount_paid)
    resolved_amount, cash, card, method = _resolve_mark_paid_amount(payload)
    amount = resolved_amount if resolved_amount is not None else remaining
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Suma încasată trebuie să fie pozitivă.")
    if amount > remaining and method:
        # Suma cerută nu încape în rest — se reduce proporțional partea de
        # numerar/card, ca cele două componente să rămână consistente cu suma
        # efectiv încasată (nu doar totalul).
        scale = remaining / amount
        cash = (cash * scale).quantize(Decimal("0.01"))
        card = remaining - cash
    amount = min(amount, remaining)

    payment.amount_paid = Decimal(payment.amount_paid) + amount
    if method:
        payment.amount_paid_cash = Decimal(payment.amount_paid_cash) + cash
        payment.amount_paid_card = Decimal(payment.amount_paid_card) + card
        payment.method = method
    payment.status = _status_for_amount(payment.amount_paid, payment.final_price)
    payment.paid_at = datetime.now(timezone.utc)
    db.commit()

    if payment.status == PaymentStatus.PLATIT:
        register_paid_session(db, payment)
    log_audit(
        db,
        actor_id=actor.id,
        action="payment.mark_paid",
        target_type="Payment",
        target_id=payment_id,
        metadata={
            "amount": str(amount),
            "resulting_status": payment.status.value,
            **({"method": method, "cash": str(cash), "card": str(card)} if method else {}),
        },
    )
    return {"ok": True}


@router.post("/package/{package_purchase_id}/mark-paid")
def mark_package_paid(
    package_purchase_id: str,
    payload: MarkPaidIn | None = None,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Ca /payments/{id}/mark-paid, dar pentru o achiziție de pachet întreagă
    — o singură sumă încasată, împărțită proporțional pe restul fiecărei
    linii neachitate (nu cu prețul total, cu ce mai are fiecare linie de
    plată), la fel cum /payments/{id}/payu-checkout tratează deja pachetul
    ca o singură plată de completat, nu terapie cu terapie."""
    lines = db.query(Payment).filter(Payment.package_purchase_id == package_purchase_id).all()
    if not lines:
        raise HTTPException(status_code=404, detail="Achiziție de pachet inexistentă.")

    outstanding = [p for p in lines if p.status != PaymentStatus.PLATIT]
    if not outstanding:
        raise HTTPException(status_code=422, detail="Acest pachet a fost deja achitat integral.")

    remaining_by_line = [(p, Decimal(p.final_price) - Decimal(p.amount_paid)) for p in outstanding]
    total_remaining = sum((r for _, r in remaining_by_line), Decimal("0"))

    resolved_amount, cash, card, method = _resolve_mark_paid_amount(payload)
    amount = resolved_amount if resolved_amount is not None else total_remaining
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Suma încasată trebuie să fie pozitivă.")
    if amount > total_remaining and method:
        scale = total_remaining / amount
        cash = (cash * scale).quantize(Decimal("0.01"))
        card = total_remaining - cash
    amount = min(amount, total_remaining)
    # Ponderea numerar/card se aplică identic pe fiecare linie, ca proporția
    # cerută de admin (ex. 50% numerar) să se reflecte pe toată achiziția,
    # nu doar pe prima linie alocată.
    cash_ratio = (cash / amount) if method and amount > 0 else Decimal("0")

    now = datetime.now(timezone.utc)
    allocated = Decimal("0")
    allocated_cash = Decimal("0")
    for idx, (p, line_remaining) in enumerate(remaining_by_line):
        is_last = idx == len(remaining_by_line) - 1
        share = amount - allocated if is_last else (amount * line_remaining / total_remaining).quantize(Decimal("0.01"))
        allocated += share
        p.amount_paid = Decimal(p.amount_paid) + share
        if method:
            line_cash = (cash - allocated_cash) if is_last else (share * cash_ratio).quantize(Decimal("0.01"))
            allocated_cash += line_cash
            p.amount_paid_cash = Decimal(p.amount_paid_cash) + line_cash
            p.amount_paid_card = Decimal(p.amount_paid_card) + (share - line_cash)
            p.method = method
        p.status = _status_for_amount(p.amount_paid, p.final_price)
        p.paid_at = now
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.mark_package_paid",
        target_type="Payment",
        target_id=package_purchase_id,
        metadata={"amount": str(amount), **({"method": method, "cash": str(cash), "card": str(card)} if method else {})},
    )
    return {"ok": True}


@router.post("/{payment_id}/correct-amount-paid")
def correct_payment_amount_paid(
    payment_id: str,
    payload: CorrectAmountPaidIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Corectează o greșeală de încasare la recepție (sumă greșită, click din
    greșeală pe "Marchează plătit") — spre deosebire de /mark-paid, care doar
    ADAUGĂ, asta ÎNLOCUIEȘTE suma încasată cu ce era corect de fapt (0 =
    anulează complet încasarea). Refuzată pentru o plată confirmată prin PayU
    — acolo banii au chiar circulat, o corecție locală n-ar anula plata reală,
    doar ar ascunde-o; o rambursare reală trebuie făcută prin PayU."""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Plată inexistentă.")
    # method == "CARD_ONLINE" se setează DOAR la confirmarea reală din webhook
    # (nu la inițierea unui checkout, care doar atașează payu_order_id) — deci
    # e semnalul corect pentru "banii chiar au ajuns prin PayU".
    if payment.method == "CARD_ONLINE":
        raise HTTPException(
            status_code=422,
            detail="Această plată a fost confirmată online prin PayU — nu poate fi corectată manual. Pentru o "
            "rambursare, e nevoie de un proces PayU real.",
        )

    new_amount = min(Decimal(str(payload.amount_paid)), Decimal(payment.final_price))
    old_status = payment.status
    payment.amount_paid = new_amount
    payment.status = _status_for_amount(new_amount, payment.final_price)
    payment.paid_at = datetime.now(timezone.utc) if new_amount > 0 else None
    # Ștampila de fidelitate urmărește "achitat integral": retrasă dacă plata
    # scade sub integral, (re)acordată dacă ajunge la integral.
    if old_status == PaymentStatus.PLATIT and payment.status != PaymentStatus.PLATIT:
        unregister_paid_session(db, payment, was_fully_paid=True)
    db.commit()
    if old_status != PaymentStatus.PLATIT and payment.status == PaymentStatus.PLATIT:
        register_paid_session(db, payment)

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.correct_amount_paid",
        target_type="Payment",
        target_id=payment_id,
        metadata={"old_status": old_status.value, "new_amount": str(new_amount), "new_status": payment.status.value},
    )
    return {"ok": True}


@router.post("/package/{package_purchase_id}/correct-amount-paid")
def correct_package_amount_paid(
    package_purchase_id: str,
    payload: CorrectAmountPaidIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Ca mai sus, dar pentru o achiziție de pachet întreagă — suma nouă totală
    se redistribuie proporțional cu prețul fiecărei linii (ca la creare, nu cu
    ce mai rămăsese), fiindcă înlocuiește, nu completează."""
    lines = db.query(Payment).filter(Payment.package_purchase_id == package_purchase_id).all()
    if not lines:
        raise HTTPException(status_code=404, detail="Achiziție de pachet inexistentă.")
    if any(p.method == "CARD_ONLINE" for p in lines):
        raise HTTPException(
            status_code=422,
            detail="Acest pachet are cel puțin o linie confirmată online prin PayU — nu poate fi corectat manual.",
        )

    total_price = sum((Decimal(p.final_price) for p in lines), Decimal("0"))
    new_total = min(Decimal(str(payload.amount_paid)), total_price)
    now = datetime.now(timezone.utc) if new_total > 0 else None

    allocated = Decimal("0")
    for idx, p in enumerate(lines):
        is_last = idx == len(lines) - 1
        share = (
            new_total - allocated
            if is_last
            else (new_total * Decimal(p.final_price) / total_price).quantize(Decimal("0.01"))
        )
        allocated += share
        p.amount_paid = share
        p.status = _status_for_amount(share, p.final_price)
        p.paid_at = now
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.correct_package_amount_paid",
        target_type="Payment",
        target_id=package_purchase_id,
        metadata={"new_total": str(new_total)},
    )
    return {"ok": True}


_PAYU_DELETE_BLOCKED = (
    "Această plată a fost confirmată online prin PayU — banii au circulat, deci nu poate fi ștearsă. "
    "Pentru o rambursare, e nevoie de un proces PayU real."
)


@router.delete("/{payment_id}")
def delete_payment(
    payment_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Șterge definitiv o linie de plată introdusă greșit. Doar ADMIN. Refuzată
    pentru o plată confirmată prin PayU și pentru o linie dintr-un pachet (acolo
    se șterge întreaga achiziție, ca pachetul să nu rămână cu linii lipsă).
    Programarea asociată, dacă există, rămâne neatinsă."""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Plată inexistentă.")
    if payment.method == "CARD_ONLINE":
        raise HTTPException(status_code=422, detail=_PAYU_DELETE_BLOCKED)
    if payment.package_purchase_id:
        raise HTTPException(
            status_code=422, detail="Această linie face parte dintr-un pachet — șterge întreaga achiziție de pachet."
        )

    unregister_paid_session(db, payment, was_fully_paid=payment.status == PaymentStatus.PLATIT)
    snapshot = {
        "client_id": payment.client_id,
        "therapy_id": payment.therapy_id,
        "final_price": str(payment.final_price),
        "amount_paid": str(payment.amount_paid),
        "status": payment.status.value,
        "appointment_id": payment.appointment_id,
    }
    db.delete(payment)
    db.commit()

    log_audit(db, actor_id=actor.id, action="payment.delete", target_type="Payment", target_id=payment_id, metadata=snapshot)
    return {"ok": True}


@router.delete("/package/{package_purchase_id}")
def delete_package_purchase(
    package_purchase_id: str,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Șterge definitiv o achiziție de pachet întreagă (toate liniile). Doar ADMIN."""
    lines = db.query(Payment).filter(Payment.package_purchase_id == package_purchase_id).all()
    if not lines:
        raise HTTPException(status_code=404, detail="Achiziție de pachet inexistentă.")
    if any(p.method == "CARD_ONLINE" for p in lines):
        raise HTTPException(status_code=422, detail=_PAYU_DELETE_BLOCKED)

    snapshot = {
        "client_id": lines[0].client_id,
        "lines": len(lines),
        "total_price": str(sum((Decimal(p.final_price) for p in lines), Decimal("0"))),
        "total_paid": str(sum((Decimal(p.amount_paid) for p in lines), Decimal("0"))),
    }
    for p in lines:
        db.delete(p)
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.delete_package",
        target_type="Payment",
        target_id=package_purchase_id,
        metadata=snapshot,
    )
    return {"ok": True}


class PayuCheckoutOut(BaseModel):
    redirect_url: str


@router.post("/{payment_id}/payu-checkout")
def create_payu_checkout(
    payment_id: str,
    request: Request,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_user),
) -> PayuCheckoutOut:
    """Inițiază o comandă PayU pentru o plată neîncasată — folosit atât din
    portalul clientului (plată pe cont propriu), cât și din admin. Nu marchează
    nimic ca plătit aici — asta se întâmplă doar din /webhooks/payu, la
    confirmarea reală venită de la PayU."""
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.client).joinedload(ClientProfile.user), joinedload(Payment.therapy), joinedload(Payment.package))
        .filter(Payment.id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Plată inexistentă.")

    if actor.role == Role.CLIENT:
        if not actor.client_profile or payment.client_id != actor.client_profile.id:
            raise HTTPException(status_code=403, detail="Nu ai acces la această plată.")
    elif actor.role not in (Role.ADMIN, Role.RECEPTIE):
        raise HTTPException(status_code=403, detail="Nu ai acces la această resursă.")

    # O plată dintr-un pachet se achită integral, dintr-o singură comandă PayU
    # care acoperă toate liniile neîncasate ale aceleiași achiziții — clientul
    # nu plătește pachetul terapie cu terapie.
    if payment.package_purchase_id:
        group = db.query(Payment).options(joinedload(Payment.therapy)).filter(
            Payment.package_purchase_id == payment.package_purchase_id
        ).all()
        ext_order_id = payment.package_purchase_id
        description = f"Pachet {payment.package.name}" if payment.package else "Pachet terapii"
    else:
        group = [payment]
        ext_order_id = payment.id
        description = payment.therapy.name

    outstanding = [p for p in group if p.status in (PaymentStatus.NEPLATIT, PaymentStatus.PARTIAL)]
    if not outstanding:
        raise HTTPException(status_code=422, detail="Această plată a fost deja achitată.")

    # Suma rămasă de plată, nu prețul integral — o linie parțial achitată
    # (ex. plătită parțial cash la recepție) se completează online doar cu
    # restul, nu se recere tot de la capăt.
    total_amount_bani = sum(int(round((float(p.final_price) - float(p.amount_paid)) * 100)) for p in outstanding)
    buyer_email = payment.client.user.email if payment.client and payment.client.user else None

    try:
        result = payu.create_order(
            ext_order_id=ext_order_id,
            total_amount_bani=total_amount_bani,
            description=description,
            customer_ip=request.client.host if request.client else "127.0.0.1",
            buyer_email=buyer_email,
            notify_url=f"{settings.public_api_base_url}/webhooks/payu",
            continue_url=f"{settings.portal_base_url}/portal/plati?payu=success",
        )
    except payu.PayuError as err:
        raise HTTPException(status_code=502, detail=str(err)) from err

    for p in outstanding:
        p.payu_order_id = result["order_id"]
    db.commit()

    log_audit(
        db,
        actor_id=actor.id,
        action="payment.payu_checkout_created",
        target_type="Payment",
        target_id=ext_order_id,
        metadata={"payu_order_id": result["order_id"], "amount_bani": total_amount_bani},
    )

    return PayuCheckoutOut(redirect_url=result["redirect_url"])


@router.get("/preview")
def preview_price(
    therapy_id: str,
    coupon_code: str | None = None,
    client_id: str | None = None,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    therapy = db.get(Therapy, therapy_id)
    if not therapy:
        return {"error": "Terapie invalidă."}

    coupon = _find_coupon(db, coupon_code)
    if coupon_code and not coupon:
        return {"error": "Cupon inexistent."}

    # Aceeași regulă ca la crearea plății: reducerea de fidelitate e automată
    # și doar când nu s-a ales explicit un cupon — vezi create_payment.
    fidelity_card = None if coupon or not client_id else find_active_card(db, client_id=client_id, therapy_id=therapy_id)
    fidelity_discount = next_session_discount_percent(fidelity_card) if fidelity_card else None

    if fidelity_discount is not None:
        base_price = Decimal(therapy.price)
        discount_amount = round_money(base_price * fidelity_discount / Decimal(100))
        final_price = base_price - discount_amount
        return {
            "base_price": str(base_price),
            "discount_amount": str(discount_amount),
            "final_price": str(final_price),
            "fidelity_card_name": fidelity_card.card_type.name,
            "fidelity_discount_percent": str(fidelity_discount),
        }

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
        [
            "Data",
            "Client",
            "Terapie",
            "Pret de baza",
            "Reducere",
            "Cupon",
            "Total",
            "Incasat",
            "Rest de plata",
            "Metoda",
            "Incasat numerar",
            "Incasat card",
            "Status",
            "Platit la",
        ]
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
                p.amount_paid,
                p.final_price - p.amount_paid,
                p.method or "",
                p.amount_paid_cash,
                p.amount_paid_card,
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
