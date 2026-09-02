from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/public")
def get_public_config() -> dict:
    return {"google_review_url": settings.google_review_url}
