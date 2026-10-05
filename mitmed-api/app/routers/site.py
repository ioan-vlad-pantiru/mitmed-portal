"""Conținut editabil al site-ului de prezentare (mitmed.ro).

Site-ul e un export static, așa că citește aceste date live prin proxy-ul
public al portalului (/api/public/announcement); adminul le editează din
Setări → Site de prezentare."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.audit import log_audit
from app.database import get_db
from app.deps import require_roles
from app.models import Role, SiteAnnouncement, User

router = APIRouter(tags=["site"])


class AnnouncementIn(BaseModel):
    enabled: bool
    text: str = Field(default="", max_length=300)
    mobile_text: str | None = Field(default=None, max_length=120)


def _get_or_create(db: DBSession) -> SiteAnnouncement:
    announcement = db.get(SiteAnnouncement, 1)
    if not announcement:
        announcement = SiteAnnouncement(id=1, enabled=False, text="")
        db.add(announcement)
        db.flush()
    return announcement


def _serialize(a: SiteAnnouncement) -> dict:
    return {"enabled": a.enabled, "text": a.text, "mobile_text": a.mobile_text, "updated_at": a.updated_at}


@router.get("/public/announcement")
def get_public_announcement(db: DBSession = Depends(get_db)) -> dict:
    """Fără autentificare — doar ce trebuie afișat (nimic dacă bara e oprită)."""
    a = db.get(SiteAnnouncement, 1)
    if not a or not a.enabled or not a.text.strip():
        return {"enabled": False, "text": None, "mobile_text": None}
    return {"enabled": True, "text": a.text, "mobile_text": a.mobile_text or None}


@router.get("/site/announcement")
def get_announcement(
    db: DBSession = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))
) -> dict:
    return _serialize(_get_or_create(db))


@router.put("/site/announcement")
def update_announcement(
    payload: AnnouncementIn,
    db: DBSession = Depends(get_db),
    actor: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    text = " ".join(payload.text.split())
    if payload.enabled and not text:
        raise HTTPException(status_code=422, detail="Scrie textul barei sau dezactiveaz-o.")
    a = _get_or_create(db)
    a.enabled = payload.enabled
    a.text = text
    a.mobile_text = " ".join((payload.mobile_text or "").split()) or None
    db.commit()
    log_audit(db, actor_id=actor.id, action="site_announcement.update", target_type="SiteAnnouncement", target_id="1", metadata={"enabled": a.enabled})
    return _serialize(a)
