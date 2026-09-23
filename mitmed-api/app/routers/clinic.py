from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import ClinicVacation, Role, User, WeekdayHours

router = APIRouter(prefix="/clinic", tags=["clinic"])

WEEKDAY_COUNT = 7


class WeekdayHoursOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    weekday: int
    is_open: bool
    opens_at: time | None
    closes_at: time | None
    break_starts_at: time | None
    break_ends_at: time | None


class WeekdayHoursIn(BaseModel):
    weekday: int
    is_open: bool
    opens_at: time | None = None
    closes_at: time | None = None
    break_starts_at: time | None = None
    break_ends_at: time | None = None

    @field_validator("weekday")
    @classmethod
    def _valid_weekday(cls, value: int) -> int:
        if not 0 <= value <= 6:
            raise ValueError("Zi invalidă.")
        return value


class WeekdayHoursListIn(BaseModel):
    days: list[WeekdayHoursIn]


class VacationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    starts_on: date
    ends_on: date
    label: str | None


class VacationIn(BaseModel):
    starts_on: date
    ends_on: date
    label: str | None = None

    @field_validator("ends_on")
    @classmethod
    def _ends_not_before_start(cls, value: date, info) -> date:
        starts_on = info.data.get("starts_on")
        if starts_on and value < starts_on:
            raise ValueError("Data de sfârșit nu poate fi înainte de data de început.")
        return value


# Programul cabinetului — un rând per zi din săptămână, editabil doar de
# ADMIN. RECEPTIE poate doar citi (are nevoie de el ca să programeze manual
# în limitele corecte), la fel ca la /therapies.


@router.get("/hours")
def list_weekday_hours(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE, Role.CLIENT))
) -> list[WeekdayHoursOut]:
    rows = {r.weekday: r for r in db.query(WeekdayHours).all()}
    # Fiecare zi trebuie să apară mereu (chiar dacă nu are încă un rând în
    # DB) — implicit închisă — ca frontend-ul să nu trateze separat cazul
    # "lipsă".
    return [
        WeekdayHoursOut.model_validate(rows[d])
        if d in rows
        else WeekdayHoursOut(weekday=d, is_open=False, opens_at=None, closes_at=None, break_starts_at=None, break_ends_at=None)
        for d in range(WEEKDAY_COUNT)
    ]


@router.put("/hours")
def update_weekday_hours(
    payload: WeekdayHoursListIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    seen = {d.weekday for d in payload.days}
    if len(seen) != len(payload.days) or seen != set(range(WEEKDAY_COUNT)):
        raise HTTPException(status_code=422, detail="Trebuie trimise exact cele 7 zile ale săptămânii, o singură dată fiecare.")

    for day in payload.days:
        if day.is_open and (not day.opens_at or not day.closes_at or day.opens_at >= day.closes_at):
            raise HTTPException(status_code=422, detail="O zi deschisă are nevoie de o oră de start și una de închidere, în ordine.")
        if bool(day.break_starts_at) != bool(day.break_ends_at):
            raise HTTPException(status_code=422, detail="Pauza are nevoie de oră de început și de sfârșit, sau de niciuna.")
        if day.break_starts_at and day.break_ends_at and day.break_starts_at >= day.break_ends_at:
            raise HTTPException(status_code=422, detail="Pauza trebuie să se termine după ce începe.")

        row = db.get(WeekdayHours, day.weekday)
        if not row:
            row = WeekdayHours(weekday=day.weekday)
            db.add(row)
        row.is_open = day.is_open
        row.opens_at = day.opens_at if day.is_open else None
        row.closes_at = day.closes_at if day.is_open else None
        row.break_starts_at = day.break_starts_at if day.is_open else None
        row.break_ends_at = day.break_ends_at if day.is_open else None

    db.commit()
    log_audit(db, actor_id=actor.id, action="clinic.update_hours", target_type="WeekdayHours", target_id="all")
    return {"ok": True}


# Vacanțe — perioade complet închise (concediu, sărbători). Blochează
# programări noi, nu ating programările deja existente.


@router.get("/vacations")
def list_vacations(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE, Role.CLIENT))
) -> list[VacationOut]:
    rows = db.query(ClinicVacation).order_by(ClinicVacation.starts_on.desc()).all()
    return [VacationOut.model_validate(r) for r in rows]


@router.post("/vacations", status_code=201)
def create_vacation(
    payload: VacationIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> VacationOut:
    vacation = ClinicVacation(
        starts_on=payload.starts_on, ends_on=payload.ends_on, label=payload.label, created_by_id=actor.id
    )
    db.add(vacation)
    db.commit()
    db.refresh(vacation)
    log_audit(db, actor_id=actor.id, action="clinic.create_vacation", target_type="ClinicVacation", target_id=vacation.id)
    return VacationOut.model_validate(vacation)


@router.delete("/vacations/{vacation_id}")
def delete_vacation(
    vacation_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    vacation = db.get(ClinicVacation, vacation_id)
    if not vacation:
        raise HTTPException(status_code=404, detail="Vacanță inexistentă.")
    db.delete(vacation)
    db.commit()
    log_audit(db, actor_id=actor.id, action="clinic.delete_vacation", target_type="ClinicVacation", target_id=vacation_id)
    return {"ok": True}
