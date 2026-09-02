import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import Consent, ConsentTemplate, Role, User

router = APIRouter(prefix="/consents", tags=["consents"])

# Cele două tipuri cu care pornește orice instalație nouă — folosite doar ca
# seed inițial (idempotent, la prima accesare), nu ca o listă fixă de valori
# valide. ADMIN poate adăuga oricând tipuri noi din /admin/documente.
DEFAULT_TEMPLATES: dict[str, tuple[str, str]] = {
    "GDPR": (
        "Acord GDPR",
        "Sunt de acord ca datele mele medicale să fie prelucrate de cabinetul MitMed "
        "(Semarvion SRL) exclusiv în scopul recuperării medicale, conform GDPR. "
        "Confirm că am fost informat/ă despre natura tratamentului și pot solicita "
        "oricând ștergerea datelor mele, cu excepția celor pe care legea ne obligă "
        "să le păstrăm.",
    ),
    "RISC_PRET": (
        "Declarație riscuri + preț",
        "Am fost informat/ă despre natura și riscurile tratamentului de "
        "fiziokinetoterapie recomandat și îmi asum aceste riscuri. Înțeleg și sunt "
        "de acord cu politica de preț a cabinetului: sumele achitate pentru ședințe "
        "sau pachete de ședințe NU se restituie, indiferent de motiv, odată ce "
        "ședința a avut loc sau pachetul a fost activat.",
    ),
}


class ConsentTemplateOut(BaseModel):
    type: str
    label: str
    text: str
    active: bool
    updated_at: datetime


class ConsentTemplateCreate(BaseModel):
    label: str = Field(min_length=2)
    text: str = Field(min_length=1)


class ConsentTemplateIn(BaseModel):
    label: str = Field(min_length=2)
    text: str = Field(min_length=1)


class ConsentIn(BaseModel):
    type: str
    signature_data_url: str  # PNG base64 din <canvas>.toDataURL()


class ConsentOut(BaseModel):
    id: str
    type: str
    version_text: str
    signed_at: datetime


def _ensure_default_templates(db: DBSession) -> None:
    """Seed idempotent — rulează o dată, la prima cerere care atinge acest
    router după o instalare nouă. Nu mai constrânge ce tipuri pot exista."""
    existing = {t for (t,) in db.query(ConsentTemplate.type).all()}
    for type_, (label, text) in DEFAULT_TEMPLATES.items():
        if type_ not in existing:
            db.add(ConsentTemplate(type=type_, label=label, text=text))
    if len(existing) < len(DEFAULT_TEMPLATES):
        db.commit()


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or "document"


def _unique_type(db: DBSession, label: str) -> str:
    base = _slugify(label)
    candidate = base
    n = 2
    while db.get(ConsentTemplate, candidate):
        candidate = f"{base}_{n}"
        n += 1
    return candidate


@router.get("/templates")
def list_consent_templates(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[ConsentTemplateOut]:
    """Toate tipurile, inclusiv cele dezactivate — pentru ecranul de admin,
    unde trebuie să poată fi reactivate."""
    _ensure_default_templates(db)
    templates = db.query(ConsentTemplate).order_by(ConsentTemplate.created_at.asc()).all()
    return [
        ConsentTemplateOut(type=t.type, label=t.label, text=t.text, active=t.active, updated_at=t.updated_at)
        for t in templates
    ]


@router.get("/templates/active")
def list_active_consent_templates(
    db: DBSession = Depends(get_db), _user: User = Depends(require_user)
) -> list[ConsentTemplateOut]:
    """Doar tipurile active — ce vede portalul clientului (declarații de
    semnat) și ecranul de Consult (badge-uri). Deschis oricărui rol logat."""
    _ensure_default_templates(db)
    templates = db.query(ConsentTemplate).filter(ConsentTemplate.active.is_(True)).order_by(
        ConsentTemplate.created_at.asc()
    ).all()
    return [
        ConsentTemplateOut(type=t.type, label=t.label, text=t.text, active=t.active, updated_at=t.updated_at)
        for t in templates
    ]


@router.post("/templates")
def create_consent_template(
    payload: ConsentTemplateCreate, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> ConsentTemplateOut:
    """ADMIN adaugă un tip nou de document de semnat (ex. "Acord vaccinare"),
    fără nicio schimbare de cod — devine imediat vizibil clienților în portal."""
    type_ = _unique_type(db, payload.label)
    template = ConsentTemplate(type=type_, label=payload.label, text=payload.text)
    db.add(template)
    db.commit()
    db.refresh(template)
    log_audit(db, actor_id=actor.id, action="consent_template.create", target_type="ConsentTemplate", target_id=type_)
    return ConsentTemplateOut(
        type=template.type, label=template.label, text=template.text, active=template.active,
        updated_at=template.updated_at,
    )


@router.put("/templates/{consent_type}")
def update_consent_template(
    consent_type: str,
    payload: ConsentTemplateIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Doar ADMIN editează textul/eticheta — se aplică doar semnăturilor
    viitoare, nu schimbă retroactiv ce au semnat deja clienții
    (Consent.version_text e un instantaneu)."""
    _ensure_default_templates(db)
    template = db.get(ConsentTemplate, consent_type)
    if not template:
        raise HTTPException(status_code=404, detail="Tip de document inexistent.")
    template.label = payload.label
    template.text = payload.text
    db.commit()
    log_audit(
        db, actor_id=actor.id, action="consent_template.update", target_type="ConsentTemplate", target_id=consent_type
    )
    return {"ok": True}


@router.post("/templates/{consent_type}/toggle")
def toggle_consent_template(
    consent_type: str,
    active: bool,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Dezactivare, nu ștergere — declarațiile deja semnate de acest tip
    rămân intacte în fișele clienților; doar dispare din lista de semnat."""
    template = db.get(ConsentTemplate, consent_type)
    if not template:
        raise HTTPException(status_code=404, detail="Tip de document inexistent.")
    template.active = active
    db.commit()
    log_audit(
        db,
        actor_id=actor.id,
        action="consent_template.activate" if active else "consent_template.deactivate",
        target_type="ConsentTemplate",
        target_id=consent_type,
    )
    return {"ok": True}


@router.delete("/templates/{consent_type}")
def delete_consent_template(
    consent_type: str, db: DBSession = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    """Ștergere reală — permisă doar dacă niciun client n-a semnat vreodată
    acest tip de document. Altfel, dezactivarea e calea corectă: declarația
    semnată își păstrează propriul text (version_text), dar eticheta ei nu
    s-ar mai putea afișa dacă tipul dispare complet."""
    template = db.get(ConsentTemplate, consent_type)
    if not template:
        raise HTTPException(status_code=404, detail="Tip de document inexistent.")

    if db.query(Consent).filter(Consent.type == consent_type).first():
        raise HTTPException(
            status_code=409,
            detail="Cel puțin un client a semnat deja acest document — dezactivează-l în loc să-l ștergi.",
        )

    db.delete(template)
    db.commit()
    log_audit(db, actor_id=actor.id, action="consent_template.delete", target_type="ConsentTemplate", target_id=consent_type)
    return {"ok": True}


@router.get("/current-text")
def get_current_consent_text(type: str, db: DBSession = Depends(get_db), _user: User = Depends(require_user)) -> dict:
    _ensure_default_templates(db)
    template = db.get(ConsentTemplate, type)
    if not template:
        raise HTTPException(status_code=404, detail="Tip de document inexistent.")
    return {"text": template.text}


@router.get("/me")
def get_own_consents(db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> list[ConsentOut]:
    if not user.client_profile:
        return []
    consents = (
        db.query(Consent)
        .filter(Consent.client_id == user.client_profile.id)
        .order_by(Consent.signed_at.desc())
        .all()
    )
    return [ConsentOut(id=c.id, type=c.type, version_text=c.version_text, signed_at=c.signed_at) for c in consents]


@router.post("/me")
def sign_consent(payload: ConsentIn, db: DBSession = Depends(get_db), user: User = Depends(require_user)) -> dict:
    if not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot semna o declarație.")
    if not payload.signature_data_url.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="Semnătura lipsește sau e invalidă.")

    template = db.get(ConsentTemplate, payload.type)
    if not template or not template.active:
        raise HTTPException(status_code=422, detail="Acest tip de document nu mai este disponibil pentru semnare.")

    consent = Consent(
        client_id=user.client_profile.id,
        type=payload.type,
        version_text=template.text,
        signature_data_url=payload.signature_data_url,
    )
    db.add(consent)
    db.commit()

    log_audit(db, actor_id=user.id, action="consent.sign", target_type="Consent", target_id=consent.id, metadata={"type": payload.type})
    return {"ok": True}


@router.get("/{client_id}")
def get_client_consents(
    client_id: str, db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[dict]:
    consents = db.query(Consent).filter(Consent.client_id == client_id).order_by(Consent.signed_at.desc()).all()
    return [
        {
            "id": c.id,
            "type": c.type,
            "version_text": c.version_text,
            "signed_at": c.signed_at,
            "signature_data_url": c.signature_data_url,
        }
        for c in consents
    ]
