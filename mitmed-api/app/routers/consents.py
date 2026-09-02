from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles, require_user
from app.models import Consent, Role, User

router = APIRouter(prefix="/consents", tags=["consents"])

CURRENT_CONSENT_VERSION = (
    "Sunt de acord ca datele mele medicale să fie prelucrate de cabinetul MitMed "
    "(Semarvion SRL) exclusiv în scopul recuperării medicale, conform GDPR. "
    "Confirm că am fost informat/ă despre natura tratamentului și pot solicita "
    "oricând ștergerea datelor mele, cu excepția celor pe care legea ne obligă "
    "să le păstrăm."
)


class ConsentIn(BaseModel):
    signature_data_url: str  # PNG base64 din <canvas>.toDataURL()


class ConsentOut(BaseModel):
    id: str
    version_text: str
    signed_at: datetime


@router.get("/me")
def get_own_consents(
    db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> list[ConsentOut]:
    if not user.client_profile:
        return []
    consents = (
        db.query(Consent)
        .filter(Consent.client_id == user.client_profile.id)
        .order_by(Consent.signed_at.desc())
        .all()
    )
    return [ConsentOut(id=c.id, version_text=c.version_text, signed_at=c.signed_at) for c in consents]


@router.get("/current-text")
def get_current_consent_text() -> dict:
    return {"text": CURRENT_CONSENT_VERSION}


@router.post("/me")
def sign_consent(
    payload: ConsentIn, db: DBSession = Depends(get_db), user: User = Depends(require_user)
) -> dict:
    if not user.client_profile:
        raise HTTPException(status_code=403, detail="Doar clienții pot semna un acord.")
    if not payload.signature_data_url.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="Semnătura lipsește sau e invalidă.")

    consent = Consent(
        client_id=user.client_profile.id,
        version_text=CURRENT_CONSENT_VERSION,
        signature_data_url=payload.signature_data_url,
    )
    db.add(consent)
    db.commit()

    log_audit(db, actor_id=user.id, action="consent.sign", target_type="Consent", target_id=consent.id)
    return {"ok": True}


@router.get("/{client_id}")
def get_client_consents(
    client_id: str, db: DBSession = Depends(get_db), _actor: User = Depends(require_roles(Role.ADMIN, Role.RECEPTIE))
) -> list[dict]:
    consents = db.query(Consent).filter(Consent.client_id == client_id).order_by(Consent.signed_at.desc()).all()
    return [
        {
            "id": c.id,
            "version_text": c.version_text,
            "signed_at": c.signed_at,
            "signature_data_url": c.signature_data_url,
        }
        for c in consents
    ]
