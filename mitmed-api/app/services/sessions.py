from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession

from app.models import Appointment, AppointmentStatus, ConsultationSheet, MedicalRecord
from app.services.packages import consume_package_session

OPEN_STATUSES = (AppointmentStatus.PROGRAMATA, AppointmentStatus.CONFIRMATA)


def complete_appointment(db: DBSession, appointment: Appointment, *, consume_scheduled: bool = True) -> bool:
    """Marchează programarea ca ținută (FINALIZATA) și scade ședința din
    pachetul activ, dacă există. Se apelează la prima documentare a ședinței
    din ecranul de Consult (notițe de tratament SAU o fișă) — o programare
    deja finalizată nu mai consumă nimic, ca o a doua fișă completată în
    aceeași vizită să nu scadă încă o ședință din pachet.

    `consume_scheduled=False`: the caller charges packages itself, based on the
    therapies actually ticked in the session (treatment notes)."""
    if appointment.status not in OPEN_STATUSES:
        return False
    appointment.status = AppointmentStatus.FINALIZATA
    db.flush()
    if consume_scheduled:
        consume_package_session(db, client_id=appointment.client_id, therapy_id=appointment.therapy_id)
    return True


def lock_appointment_for_client(db: DBSession, appointment_id: str, client_id: str) -> Appointment:
    """The appointment being documented from Consult, row-locked until commit.
    Two concurrent saves for the same appointment (double click, two tabs) are
    serialized, so the second finds the first one's record and updates it."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).with_for_update().first()
    if not appointment or appointment.client_id != client_id:
        raise HTTPException(status_code=422, detail="Programarea nu aparține acestui client.")
    if appointment.status == AppointmentStatus.ANULATA:
        raise HTTPException(status_code=422, detail="Programarea e anulată.")
    return appointment


def record_for_appointment(db: DBSession, appointment_id: str) -> MedicalRecord | None:
    """The appointment's treatment record. There is only one; if older
    duplicates exist, the most recent wins."""
    return (
        db.query(MedicalRecord)
        .filter(MedicalRecord.appointment_id == appointment_id)
        .order_by(MedicalRecord.created_at.desc())
        .first()
    )


def sheets_for_appointment(db: DBSession, appointment_id: str) -> dict[str, ConsultationSheet]:
    """The appointment's sheets, one per template (the most recent)."""
    sheets: dict[str, ConsultationSheet] = {}
    for sheet in (
        db.query(ConsultationSheet)
        .filter(ConsultationSheet.appointment_id == appointment_id)
        .order_by(ConsultationSheet.created_at.desc())
    ):
        sheets.setdefault(sheet.template_id, sheet)
    return sheets
