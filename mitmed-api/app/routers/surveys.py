"""Sondajul de satisfacție din portal.

Clientul răspunde, din contul lui, despre ultima vizită finalizată (cel mult o
dată per programare); după trimitere i se arată linkul spre recenziile MitMed
pe Google Maps — tuturor, indiferent de note, cum cer regulile Google.
Adminul configurează întrebările și vede rezultatele."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession, joinedload

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import (
    SURVEY_KINDS,
    Appointment,
    AppointmentStatus,
    ClientProfile,
    Role,
    SurveyQuestion,
    SurveyResponse,
    SurveySettings,
    User,
)

router = APIRouter(prefix="/survey", tags=["survey"])

# O vizită mai veche de atât nu mai e propusă pentru evaluare.
PENDING_WINDOW = timedelta(days=60)
MAX_TEXT = 2000


def _settings(db: DBSession) -> SurveySettings:
    s = db.get(SurveySettings, 1)
    if not s:
        s = SurveySettings(id=1, enabled=True)
        db.add(s)
        db.flush()
    return s


def _active_questions(db: DBSession) -> list[SurveyQuestion]:
    return (
        db.query(SurveyQuestion)
        .filter(SurveyQuestion.archived.is_(False))
        .order_by(SurveyQuestion.position, SurveyQuestion.created_at)
        .all()
    )


def _serialize_question(q: SurveyQuestion) -> dict:
    return {
        "id": q.id,
        "label": q.label,
        "kind": q.kind,
        "options": q.options or [],
        "required": q.required,
        "position": q.position,
        "archived": q.archived,
    }


def _own_client(user: User) -> ClientProfile:
    if not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot răspunde la sondaj.")
    return user.client_profile


def _pending_appointment(db: DBSession, client_id: str) -> Appointment | None:
    """Ultima vizită finalizată, recentă, la care clientul n-a răspuns încă."""
    latest = (
        db.query(Appointment)
        .options(joinedload(Appointment.therapy))
        .filter(
            Appointment.client_id == client_id,
            Appointment.status == AppointmentStatus.FINALIZATA,
            Appointment.starts_at >= datetime.now(timezone.utc) - PENDING_WINDOW,
        )
        .order_by(Appointment.starts_at.desc())
        .first()
    )
    if not latest:
        return None
    answered = db.query(SurveyResponse.id).filter(SurveyResponse.appointment_id == latest.id).first()
    return None if answered else latest


# --- Client --------------------------------------------------------------------


@router.get("/me")
def get_own_survey(db: DBSession = Depends(get_db), user: User = Depends(require_roles(Role.CLIENT))) -> dict:
    client = _own_client(user)
    settings = _settings(db)
    db.commit()
    questions = _active_questions(db)
    pending = _pending_appointment(db, client.id) if settings.enabled and questions else None
    answered = db.query(func.count(SurveyResponse.id)).filter(SurveyResponse.client_id == client.id).scalar()
    return {
        "enabled": settings.enabled and bool(questions),
        "questions": [_serialize_question(q) for q in questions],
        "pending": (
            {"appointment_id": pending.id, "starts_at": pending.starts_at, "therapy_name": pending.therapy.name}
            if pending
            else None
        ),
        "answered_count": answered,
        "google_review_url": settings.google_review_url,
    }


class SurveyAnswerIn(BaseModel):
    appointment_id: str
    answers: dict[str, int | str | list[str] | None] = {}


def _clean_answers(questions: list[SurveyQuestion], raw: dict) -> dict:
    """Validează răspunsurile față de întrebările active; ignoră cheile necunoscute."""
    clean: dict = {}
    for q in questions:
        value = raw.get(q.id)
        if q.kind == "rating":
            if value in (None, ""):
                value = None
            elif not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 5:
                raise HTTPException(status_code=422, detail=f"„{q.label}”: alege o notă de la 1 la 5.")
        elif q.kind == "choice":
            value = value.strip() if isinstance(value, str) else None
            if value and value not in (q.options or []):
                raise HTTPException(status_code=422, detail=f"„{q.label}”: variantă necunoscută.")
            value = value or None
        elif q.kind == "multi":
            values = value if isinstance(value, list) else []
            if any(v not in (q.options or []) for v in values):
                raise HTTPException(status_code=422, detail=f"„{q.label}”: variantă necunoscută.")
            value = list(dict.fromkeys(values)) or None
        else:
            value = value.strip()[:MAX_TEXT] if isinstance(value, str) else None
            value = value or None
        if value is None:
            if q.required:
                raise HTTPException(status_code=422, detail=f"Răspunde la „{q.label}”.")
            continue
        clean[q.id] = value
    if not clean:
        raise HTTPException(status_code=422, detail="Răspunde la cel puțin o întrebare.")
    return clean


@router.post("/me")
def submit_own_survey(
    payload: SurveyAnswerIn,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_roles(Role.CLIENT)),
) -> dict:
    client = _own_client(user)
    settings = _settings(db)
    if not settings.enabled:
        raise HTTPException(status_code=409, detail="Sondajul nu este activ momentan.")
    appointment = db.get(Appointment, payload.appointment_id)
    if not appointment or appointment.client_id != client.id:
        raise HTTPException(status_code=404, detail="Programare inexistentă.")
    if appointment.status != AppointmentStatus.FINALIZATA:
        raise HTTPException(status_code=409, detail="Poți evalua doar o vizită încheiată.")
    if db.query(SurveyResponse.id).filter(SurveyResponse.appointment_id == appointment.id).first():
        raise HTTPException(status_code=409, detail="Ai trimis deja părerea ta despre această vizită. Mulțumim!")

    answers = _clean_answers(_active_questions(db), payload.answers)
    response = SurveyResponse(client_id=client.id, appointment_id=appointment.id, answers=answers)
    db.add(response)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ai trimis deja părerea ta despre această vizită. Mulțumim!")
    log_audit(db, actor_id=user.id, action="survey.submit", target_type="SurveyResponse", target_id=response.id)
    return {"ok": True, "google_review_url": settings.google_review_url}


# --- Admin: întrebări și setări -----------------------------------------------------


class QuestionIn(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    kind: str = "rating"
    options: list[str] = []
    required: bool = False


def _validated(payload: QuestionIn) -> tuple[str, str, list[str] | None]:
    label = " ".join(payload.label.split())
    if not label:
        raise HTTPException(status_code=422, detail="Scrie textul întrebării.")
    if payload.kind not in SURVEY_KINDS:
        raise HTTPException(status_code=422, detail="Tip de întrebare necunoscut.")
    options = None
    if payload.kind in ("choice", "multi"):
        options = list(dict.fromkeys(o.strip()[:100] for o in payload.options if o.strip()))
        if len(options) < 2:
            raise HTTPException(status_code=422, detail="Adaugă cel puțin două variante de răspuns.")
    return label, payload.kind, options


@router.get("/questions")
def list_questions(db: DBSession = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))) -> list[dict]:
    questions = (
        db.query(SurveyQuestion)
        .order_by(SurveyQuestion.archived, SurveyQuestion.position, SurveyQuestion.created_at)
        .all()
    )
    return [_serialize_question(q) for q in questions]


@router.post("/questions")
def create_question(
    payload: QuestionIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    label, kind, options = _validated(payload)
    last = db.query(func.max(SurveyQuestion.position)).filter(SurveyQuestion.archived.is_(False)).scalar()
    q = SurveyQuestion(label=label, kind=kind, options=options, required=payload.required, position=(last or 0) + 1)
    db.add(q)
    db.commit()
    log_audit(db, actor_id=actor.id, action="survey_question.create", target_type="SurveyQuestion", target_id=q.id)
    return _serialize_question(q)


@router.put("/questions/{question_id}")
def update_question(
    question_id: str,
    payload: QuestionIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    q = db.get(SurveyQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Întrebare inexistentă.")
    label, kind, options = _validated(payload)
    has_answers = _answer_count(db, q.id) > 0
    if has_answers and kind != q.kind:
        raise HTTPException(
            status_code=409,
            detail="Întrebarea are deja răspunsuri — nu i se mai poate schimba tipul. Șterge-o și adaugă una nouă.",
        )
    q.label, q.kind, q.options, q.required = label, kind, options, payload.required
    db.commit()
    log_audit(db, actor_id=actor.id, action="survey_question.update", target_type="SurveyQuestion", target_id=q.id)
    return _serialize_question(q)


def _answer_count(db: DBSession, question_id: str) -> int:
    return sum(1 for (answers,) in db.query(SurveyResponse.answers).all() if question_id in (answers or {}))


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    """Fără răspunsuri se șterge de tot; cu răspunsuri se arhivează, ca rezultatele să rămână."""
    q = db.get(SurveyQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Întrebare inexistentă.")
    if _answer_count(db, q.id):
        q.archived = True
        outcome = "archived"
    else:
        db.delete(q)
        outcome = "deleted"
    db.commit()
    log_audit(db, actor_id=actor.id, action=f"survey_question.{outcome}", target_type="SurveyQuestion", target_id=question_id)
    return {"ok": True, "outcome": outcome}


@router.post("/questions/{question_id}/restore")
def restore_question(
    question_id: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    q = db.get(SurveyQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Întrebare inexistentă.")
    last = db.query(func.max(SurveyQuestion.position)).filter(SurveyQuestion.archived.is_(False)).scalar()
    q.archived = False
    q.position = (last or 0) + 1
    db.commit()
    log_audit(db, actor_id=actor.id, action="survey_question.restore", target_type="SurveyQuestion", target_id=q.id)
    return _serialize_question(q)


class MoveIn(BaseModel):
    direction: str


@router.post("/questions/{question_id}/move")
def move_question(
    question_id: str, payload: MoveIn, db: DBSession = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    questions = _active_questions(db)
    index = next((i for i, q in enumerate(questions) if q.id == question_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Întrebare inexistentă.")
    target = index - 1 if payload.direction == "up" else index + 1
    if 0 <= target < len(questions):
        questions[index], questions[target] = questions[target], questions[index]
    for position, q in enumerate(questions):
        q.position = position
    db.commit()
    return {"ok": True}


class SettingsIn(BaseModel):
    enabled: bool
    google_review_url: str | None = Field(default=None, max_length=500)


def _serialize_settings(s: SurveySettings) -> dict:
    return {"enabled": s.enabled, "google_review_url": s.google_review_url}


@router.get("/settings")
def get_settings(db: DBSession = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))) -> dict:
    s = _settings(db)
    db.commit()
    return _serialize_settings(s)


@router.put("/settings")
def update_settings(
    payload: SettingsIn, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    url = (payload.google_review_url or "").strip() or None
    if url and not url.startswith("https://"):
        raise HTTPException(status_code=422, detail="Linkul trebuie să înceapă cu https://")
    s = _settings(db)
    s.enabled = payload.enabled
    s.google_review_url = url
    db.commit()
    log_audit(db, actor_id=actor.id, action="survey_settings.update", target_type="SurveySettings", target_id="1")
    return _serialize_settings(s)


# --- Admin: rezultate -----------------------------------------------------------------


@router.get("/results")
def get_results(db: DBSession = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))) -> dict:
    questions = db.query(SurveyQuestion).order_by(SurveyQuestion.archived, SurveyQuestion.position).all()
    responses = (
        db.query(SurveyResponse)
        .options(
            joinedload(SurveyResponse.client),
            joinedload(SurveyResponse.appointment).joinedload(Appointment.therapy),
        )
        .order_by(SurveyResponse.created_at.desc())
        .all()
    )

    rating_ids = {q.id for q in questions if q.kind == "rating"}
    per_question = []
    for q in questions:
        values = [r.answers[q.id] for r in responses if q.id in (r.answers or {})]
        item = {**_serialize_question(q), "answered": len(values)}
        if q.kind == "rating":
            counts = Counter(v for v in values if isinstance(v, int))
            item["average"] = round(sum(k * c for k, c in counts.items()) / max(1, sum(counts.values())), 2) if counts else None
            item["distribution"] = [{"label": str(n), "count": counts.get(n, 0)} for n in range(5, 0, -1)]
        elif q.kind in ("choice", "multi"):
            counts = Counter()
            for v in values:
                counts.update(v if isinstance(v, list) else [v])
            labels = list(q.options or []) + [k for k in counts if k not in (q.options or [])]
            item["distribution"] = [{"label": label, "count": counts.get(label, 0)} for label in labels]
        else:
            item["texts"] = [
                {"text": r.answers[q.id], "created_at": r.created_at, "client_name": r.client.full_name}
                for r in responses
                if q.id in (r.answers or {})
            ][:30]
        per_question.append(item)

    def mean_rating(r: SurveyResponse) -> float | None:
        vals = [v for k, v in (r.answers or {}).items() if k in rating_ids and isinstance(v, int)]
        return sum(vals) / len(vals) if vals else None

    all_ratings = [v for r in responses for k, v in (r.answers or {}).items() if k in rating_ids and isinstance(v, int)]
    monthly: dict[str, list] = defaultdict(list)
    for r in responses:
        monthly[r.created_at.strftime("%Y-%m")].append(mean_rating(r))
    now = datetime.now(timezone.utc)
    months = []
    for back in range(5, -1, -1):
        y, m = now.year, now.month - back
        while m <= 0:
            y, m = y - 1, m + 12
        key = f"{y:04d}-{m:02d}"
        scores = [s for s in monthly.get(key, []) if s is not None]
        months.append({
            "month": key,
            "responses": len(monthly.get(key, [])),
            "average": round(sum(scores) / len(scores), 2) if scores else None,
        })

    satisfied = sum(1 for r in responses if (s := mean_rating(r)) is not None and s >= 4)
    rated = sum(1 for r in responses if mean_rating(r) is not None)

    return {
        "total_responses": len(responses),
        "average_rating": round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else None,
        "satisfied_share": round(satisfied * 100 / rated) if rated else None,
        "responses_this_month": len(monthly.get(now.strftime("%Y-%m"), [])),
        "monthly": months,
        "questions": per_question,
        "responses": [
            {
                "id": r.id,
                "created_at": r.created_at,
                "client": {"id": r.client_id, "full_name": r.client.full_name},
                "appointment": (
                    {"starts_at": r.appointment.starts_at, "therapy_name": r.appointment.therapy.name}
                    if r.appointment
                    else None
                ),
                "average": round(s, 2) if (s := mean_rating(r)) is not None else None,
                "answers": r.answers,
            }
            for r in responses[:100]
        ],
    }
