from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import Consent, ConsentTemplate, ConsentType, Role, User

router = APIRouter(prefix="/consents", tags=["consents"])

DEFAULT_TEMPLATES: dict[ConsentType, str] = {
    ConsentType.GDPR: (
        "Sunt de acord ca datele mele medicale să fie prelucrate de cabinetul MitMed "
        "(Semarvion SRL) exclusiv în scopul recuperării medicale, conform GDPR. "
        "Confirm că am fost informat/ă despre natura tratamentului și pot solicita "
        "oricând ștergerea datelor mele, cu excepția celor pe care legea ne obligă "
        "să le păstrăm."
    ),
    ConsentType.RISC_PRET: (
        "Am fost informat/ă despre natura și riscurile tratamentului de "
        "fiziokinetoterapie recomandat și îmi asum aceste riscuri. Înțeleg și sunt "
        "de acord cu politica de preț a cabinetului: sumele achitate pentru ședințe "
        "sau pachete de ședințe NU se restituie, indiferent de motiv, odată ce "
        "ședința a avut loc sau pachetul a fost activat."
    ),
}


class ConsentTemplateOut(BaseModel):
    type: ConsentType
    text: str
    updated_at: datetime


class ConsentTemplateIn(BaseModel):
    text: str


class ConsentIn(BaseModel):
    type: ConsentType
    signature_data_url: str  # PNG base64 din <canvas>.toDataURL()


class ConsentOut(BaseModel):
    id: str
    type: ConsentType
    version_text: str
    signed_at: datetime


def _get_or_create_template(db: DBSession, consent_type: ConsentType) -> ConsentTemplate:
    template = db.get(ConsentTemplate, consent_type)
    if not template:
        template = ConsentTemplate(type=consent_type, text=DEFAULT_TEMPLATES[consent_type])
        db.add(template)
        db.commit()
        db.refresh(template)
    return template


@router.get("/templates")
def list_consent_templates(
    db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[ConsentTemplateOut]:
    templates = [_get_or_create_template(db, t) for t in ConsentType]
    return [ConsentTemplateOut(type=t.type, text=t.text, updated_at=t.updated_at) for t in templates]


@router.put("/templates/{consent_type}")
def update_consent_template(
    consent_type: ConsentType,
    payload: ConsentTemplateIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    """Doar ADMIN editează textul — se aplică doar semnăturilor viitoare, nu
    schimbă retroactiv ce au semnat deja clienții (Consent.version_text e un
    instantaneu)."""
    template = _get_or_create_template(db, consent_type)
    template.text = payload.text
    db.commit()
    log_audit(
        db, actor_id=actor.id, action="consent_template.update", target_type="ConsentTemplate", target_id=consent_type.value
    )
    return {"ok": True}


@router.get("/current-text")
def get_current_consent_text(
    type: ConsentType, db: DBSession = Depends(get_db), _user: User = Depends(require_user)
) -> dict:
    return {"text": _get_or_create_template(db, type).text}


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

    template = _get_or_create_template(db, payload.type)
    consent = Consent(
        client_id=user.client_profile.id,
        type=payload.type,
        version_text=template.text,
        signature_data_url=payload.signature_data_url,
    )
    db.add(consent)
    db.commit()

    log_audit(db, actor_id=user.id, action="consent.sign", target_type="Consent", target_id=consent.id, metadata={"type": payload.type.value})
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
