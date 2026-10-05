from sqlalchemy.orm import Session as DBSession

from app.models import Appointment, AppointmentStatus
from app.services.packages import consume_package_session

OPEN_STATUSES = (AppointmentStatus.PROGRAMATA, AppointmentStatus.CONFIRMATA)


def complete_appointment(db: DBSession, appointment: Appointment) -> bool:
    """Marchează programarea ca ținută (FINALIZATA) și scade ședința din
    pachetul activ, dacă există. Se apelează la prima documentare a ședinței
    din ecranul de Consult (notițe de tratament SAU o fișă) — o programare
    deja finalizată nu mai consumă nimic, ca o a doua fișă completată în
    aceeași vizită să nu scadă încă o ședință din pachet."""
    if appointment.status not in OPEN_STATUSES:
        return False
    appointment.status = AppointmentStatus.FINALIZATA
    db.flush()
    consume_package_session(db, client_id=appointment.client_id, therapy_id=appointment.therapy_id)
    return True
