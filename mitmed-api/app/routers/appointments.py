import logging
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import (
    Appointment,
    AppointmentStatus,
    ClientProfile,
    Consent,
    MedicalRecord,
    Payment,
    PaymentStatus,
    Role,
    Therapy,
    User,
)
from app.services.google_calendar import sync_appointment_cancelled, sync_appointment_created

logger = logging.getLogger("mitmed.appointments")

router = APIRouter(prefix="/appointments", tags=["appointments"])

MIN_CANCEL_NOTICE = timedelta(hours=48)
CLINIC_TIMEZONE = ZoneInfo("Europe/Bucharest")
CLINIC_OPENS_AT = time(hour=9)
CLINIC_CLOSES_AT = time(hour=18)
BOOKABLE_STATUSES = (AppointmentStatus.PROGRAMATA, AppointmentStatus.CONFIRMATA)


def _void_unpaid_appointment_payment(db: DBSession, appointment_id: str) -> None:
    """Șterge plata auto-generată la programare (create_own_appointment) dacă
    programarea e anulată înainte să fie achitată — altfel clientul rămâne cu
    o datorie fantomă pentru o ședință care n-a mai avut loc. O plată deja
    parțial/integral achitată NU se atinge — aia se rezolvă manual (rambursare)."""
    payment = (
        db.query(Payment)
        .filter(Payment.appointment_id == appointment_id, Payment.status == PaymentStatus.NEPLATIT)
        .first()
    )
    if payment:
        db.delete(payment)
        db.commit()


def _ensure_cancellable(appointment: Appointment) -> None:
    """Regulă unică de anulare — valabilă atât pentru client, cât și pentru
    admin/recepție: cu minim 48h înainte de programare. Sub acest prag,
    anularea se refuză (întâlnirea rămâne, trebuie gestionată manual —
    telefon/reprogramare)."""
    if appointment.status != AppointmentStatus.PROGRAMATA and appointment.status != AppointmentStatus.CONFIRMATA:
        raise HTTPException(status_code=422, detail="Această programare nu mai poate fi anulată.")
    if appointment.starts_at - datetime.now(timezone.utc) < MIN_CANCEL_NOTICE:
        raise HTTPException(
            status_code=422,
            detail="Anularea este posibilă doar cu cel puțin 48 de ore înainte de programare.",
        )


class OwnAppointmentIn(BaseModel):
    therapy_id: str
    starts_at: datetime


class StaffAppointmentIn(BaseModel):
    client_id: str
    therapy_id: str
    starts_at: datetime


def _to_clinic_time(value: datetime) -> datetime:
    """Datele vechi pot fi naive; le interpretăm consecvent în fusul clinicii."""
    if value.tzinfo is None:
        return value.replace(tzinfo=CLINIC_TIMEZONE)
    return value.astimezone(CLINIC_TIMEZONE)


def _available_slot_starts(db: DBSession, *, day: date, therapy: Therapy) -> list[datetime]:
    """Construiește sloturi consecutive din golurile reale ale agendei.

    Pasul este durata terapiei, nu un set global de ore predefinite. Astfel, o
    ședință de 30 de minute se poate alipi direct de o programare existentă.
    """
    if day.weekday() >= 5:
        return []

    day_start = datetime.combine(day, CLINIC_OPENS_AT, tzinfo=CLINIC_TIMEZONE)
    day_end = datetime.combine(day, CLINIC_CLOSES_AT, tzinfo=CLINIC_TIMEZONE)
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.therapy))
        .filter(
            Appointment.status.in_(BOOKABLE_STATUSES),
            Appointment.starts_at < day_end.astimezone(timezone.utc),
        )
        .order_by(Appointment.starts_at.asc())
        .all()
    )

    occupied: list[tuple[datetime, datetime]] = []
    for appointment in appointments:
        starts_at = _to_clinic_time(appointment.starts_at)
        ends_at = starts_at + timedelta(minutes=appointment.therapy.duration_minutes)
        if ends_at > day_start and starts_at < day_end:
            occupied.append((max(starts_at, day_start), min(ends_at, day_end)))

    slots: list[datetime] = []
    cursor = day_start
    duration = timedelta(minutes=therapy.duration_minutes)
    for starts_at, ends_at in occupied:
        while cursor + duration <= starts_at:
            slots.append(cursor)
            cursor += duration
        cursor = max(cursor, ends_at)
    while cursor + duration <= day_end:
        slots.append(cursor)
        cursor += duration
    return slots


def _ensure_own_slot_is_available(db: DBSession, *, starts_at: datetime, therapy: Therapy) -> None:
    local_start = _to_clinic_time(starts_at)
    valid_starts = _available_slot_starts(db, day=local_start.date(), therapy=therapy)
    if local_start not in valid_starts:
        raise HTTPException(
            status_code=409,
            detail="Intervalul selectat nu mai este disponibil. Alege o altă oră.",
        )


def _create_appointment(
    db: DBSession,
    *,
    client_id: str,
    therapy_id: str,
    starts_at: datetime,
    created_by_id: str,
    enforce_live_availability: bool = False,
) -> Appointment:
    therapy = db.get(Therapy, therapy_id)
    if not therapy or not therapy.active:
        raise HTTPException(status_code=422, detail="Terapia selectată nu este disponibilă.")

    if _to_clinic_time(starts_at).weekday() >= 5:
        raise HTTPException(status_code=422, detail="Programările sunt disponibile de luni până vineri.")

    if enforce_live_availability:
        _ensure_own_slot_is_available(db, starts_at=starts_at, therapy=therapy)

    client = db.get(ClientProfile, client_id)
    if not client:
        raise HTTPException(status_code=422, detail="Client inexistent.")

    google_event_id = None
    try:
        google_event_id = sync_appointment_created(
            summary=f"{therapy.name} — {client.full_name}",
            description=f"Programare MitMed pentru {client.full_name}",
            starts_at=starts_at,
            duration_minutes=therapy.duration_minutes,
        )
    except Exception:
        logger.exception("sincronizare Google Calendar eșuată pentru programarea %s", client_id)

    appointment = Appointment(
        client_id=client_id,
        therapy_id=therapy_id,
        starts_at=starts_at,
        created_by_id=created_by_id,
        google_calendar_event_id=google_event_id,
    )
    db.add(appointment)
    try:
        db.commit()
    except IntegrityError:
        # Ultima linie de apărare împotriva dublei-rezervări: indexul unic
        # parțial ux_appointments_active_slot (vezi models.py) respinge la
        # nivel de DB două programări active pe aceeași terapie+oră, chiar
        # dacă verificarea de disponibilitate de mai sus a trecut pentru
        # ambele cereri concurente.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Intervalul selectat tocmai a fost ocupat de altcineva. Alege o altă oră.",
        )
    db.refresh(appointment)

    log_audit(
        db,
        actor_id=created_by_id,
        action="appointment.create",
        target_type="Appointment",
        target_id=appointment.id,
        metadata={"client_id": client_id},
    )
    return appointment


@router.post("/me")
def create_own_appointment(
    payload: OwnAppointmentIn, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot face programări din contul lor.")

    appointment = _create_appointment(
        db,
        client_id=user.client_profile.id,
        therapy_id=payload.therapy_id,
        starts_at=payload.starts_at,
        created_by_id=user.id,
        enforce_live_availability=True,
    )

    # Ședința se plătește pe loc, imediat ce e programată — DOAR dacă
    # clientul n-are deja un pachet activ pentru aceeași terapie (caz în care
    # ședința se scade din pachet la momentul consultului, vezi
    # services/packages.consume_package_session, fără o plată nouă).
    has_active_package = (
        db.query(Payment)
        .filter(
            Payment.client_id == user.client_profile.id,
            Payment.therapy_id == payload.therapy_id,
            Payment.package_total_sessions.is_not(None),
            Payment.sessions_used < Payment.package_total_sessions,
        )
        .first()
    )
    payment_id = None
    if not has_active_package:
        therapy = db.get(Therapy, payload.therapy_id)
        payment = Payment(
            client_id=user.client_profile.id,
            therapy_id=payload.therapy_id,
            appointment_id=appointment.id,
            base_price=therapy.price,
            discount_amount=0,
            final_price=therapy.price,
            status=PaymentStatus.NEPLATIT,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        payment_id = payment.id

    return {"ok": True, "id": appointment.id, "payment_id": payment_id}


@router.get("/availability")
def own_appointment_availability(
    day: date,
    therapy_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_user),
) -> dict:
    """Ore rezervabile fără a expune agenda sau datele altor clienți."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot vedea disponibilitatea din portal.")

    therapy = db.get(Therapy, therapy_id)
    if not therapy or not therapy.active:
        raise HTTPException(status_code=422, detail="Terapia selectată nu este disponibilă.")

    slots = _available_slot_starts(db, day=day, therapy=therapy)
    return {"slots": [slot.strftime("%H:%M") for slot in slots]}


@router.post("/staff")
def create_appointment_for_client(
    payload: StaffAppointmentIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    appointment = _create_appointment(
        db,
        client_id=payload.client_id,
        therapy_id=payload.therapy_id,
        starts_at=payload.starts_at,
        created_by_id=actor.id,
    )
    return {"ok": True, "id": appointment.id}


@router.post("/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> dict:
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Programare inexistentă.")
    _ensure_cancellable(appointment)

    appointment.status = AppointmentStatus.ANULATA
    db.commit()
    _void_unpaid_appointment_payment(db, appointment_id)

    sync_appointment_cancelled(appointment.google_calendar_event_id)

    log_audit(db, actor_id=actor.id, action="appointment.cancel", target_type="Appointment", target_id=appointment_id)
    return {"ok": True}


@router.post("/{appointment_id}/cancel/me")
def cancel_own_appointment(
    appointment_id: str, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    """Clientul își anulează propria programare — aceeași regulă de 48h ca
    la anularea făcută de recepție, plus verificarea că programarea chiar
    e a lui (nu poate anula pe cineva altcineva doar știindu-i id-ul)."""
    if user.role != Role.CLIENT or not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții își pot anula propriile programări.")

    appointment = db.get(Appointment, appointment_id)
    if not appointment or appointment.client_id != user.client_profile.id:
        raise HTTPException(status_code=404, detail="Programare inexistentă.")
    _ensure_cancellable(appointment)

    appointment.status = AppointmentStatus.ANULATA
    db.commit()
    _void_unpaid_appointment_payment(db, appointment_id)

    sync_appointment_cancelled(appointment.google_calendar_event_id)

    log_audit(db, actor_id=user.id, action="appointment.cancel_own", target_type="Appointment", target_id=appointment_id)
    return {"ok": True}


@router.get("")
def list_appointments_in_range(
    start: datetime,
    end: datetime,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> list[dict]:
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.client), joinedload(Appointment.therapy))
        .filter(Appointment.starts_at >= start, Appointment.starts_at < end)
        .order_by(Appointment.starts_at.asc())
        .all()
    )
    return [
        {
            "id": a.id,
            "client_id": a.client_id,
            "client_name": a.client.full_name,
            "therapy_id": a.therapy_id,
            "therapy_name": a.therapy.name,
            "starts_at": a.starts_at,
            "duration_minutes": a.therapy.duration_minutes,
            "status": a.status,
        }
        for a in appointments
    ]


@router.get("/{appointment_id}/consult")
def get_appointment_for_consult(
    appointment_id: str,
    db: DBSession = Depends(get_db),
    _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE)),
) -> dict:
    """Tot ce trebuie ecranului de Consult, într-un singur apel — istoric
    recent, chestionar, consimțăminte semnate, pachet activ — ca operatorul
    să nu piardă timp cu roundtrip-uri multiple în timpul unei ședințe."""
    appointment = (
        db.query(Appointment)
        .options(joinedload(Appointment.client), joinedload(Appointment.therapy))
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Programare inexistentă.")

    client = appointment.client

    recent_records = (
        db.query(MedicalRecord)
        .options(joinedload(MedicalRecord.therapy))
        .filter(MedicalRecord.client_id == client.id)
        .order_by(MedicalRecord.session_date.desc())
        .limit(3)
        .all()
    )

    consents = (
        db.query(Consent)
        .filter(Consent.client_id == client.id)
        .order_by(Consent.signed_at.desc())
        .all()
    )

    # Pachet activ pentru terapia programată — cel mai vechi neepuizat, aceeași
    # regulă FIFO ca la consumul efectiv (app/services/packages.py).
    active_package = (
        db.query(Payment)
        .filter(
            Payment.client_id == client.id,
            Payment.therapy_id == appointment.therapy_id,
            Payment.package_total_sessions.is_not(None),
            Payment.sessions_used < Payment.package_total_sessions,
        )
        .order_by(Payment.created_at.asc())
        .first()
    )

    return {
        "appointment": {
            "id": appointment.id,
            "starts_at": appointment.starts_at,
            "status": appointment.status,
            "therapy": {"id": appointment.therapy_id, "name": appointment.therapy.name},
        },
        "client": {
            "id": client.id,
            "full_name": client.full_name,
            "birth_date": client.birth_date,
            "phone": client.phone,
            "medical_history": client.medical_history,
        },
        "recent_records": [
            {
                "id": r.id,
                "session_date": r.session_date,
                "diagnosis": r.diagnosis,
                "notes": r.notes,
                "treatment_plan": r.treatment_plan,
                "therapy_name": r.therapy.name if r.therapy else None,
            }
            for r in recent_records
        ],
        "consents": [{"type": c.type, "signed_at": c.signed_at} for c in consents],
        "active_package": (
            {
                "payment_id": active_package.id,
                "sessions_used": active_package.sessions_used,
                "package_total_sessions": active_package.package_total_sessions,
            }
            if active_package
            else None
        ),
    }
