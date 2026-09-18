import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import DEFAULT_SEED_ADMIN_PASSWORD, settings
from app.rate_limit import limiter
from app.scheduler import start_scheduler, scheduler
from app.routers import (
    appointments,
    auth,
    clients,
    config_public,
    consents,
    coupons,
    insights,
    medical_records,
    packages,
    payments,
    public,
    therapies,
    webhooks,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("mitmed")

if settings.environment == "production" and settings.seed_admin_password == DEFAULT_SEED_ADMIN_PASSWORD:
    raise RuntimeError(
        "SEED_ADMIN_PASSWORD nu a fost schimbat față de valoarea implicită din cod — "
        "setează o parolă unică în .env înainte de a porni în producție."
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_scheduler()
    logger.info("API pornit (environment=%s)", settings.environment)
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="MitMed API", lifespan=lifespan)

# Rate limiting per-IP — apărare de bază împotriva brute-force/credential
# stuffing pe login și spam pe formularul public de programare. Stocare
# in-memory (vezi app/rate_limit.py): suficientă cât timp rulează o singură
# instanță API (vezi docker-compose.yml) — dacă se trece la mai multe
# instanțe, mutați storage-ul pe Redis (`Limiter(storage_uri="redis://...")`).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(therapies.router)
app.include_router(packages.router)
app.include_router(coupons.router)
app.include_router(medical_records.router)
app.include_router(payments.router)
app.include_router(appointments.router)
app.include_router(insights.router)
app.include_router(consents.router)
app.include_router(public.router)
app.include_router(config_public.router)
app.include_router(webhooks.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
