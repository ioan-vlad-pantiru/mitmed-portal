from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="MitMed API", lifespan=lifespan)

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


@app.get("/health")
def health() -> dict:
    return {"ok": True}
