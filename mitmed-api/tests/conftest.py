"""Configurație de test comună.

Rulează contra unei baze Postgres REALE (nu SQLite) — indexul unic parțial
(ux_appointments_active_slot) și `SELECT ... FOR UPDATE` din
services/packages.py sunt comportamente specifice Postgres pe care SQLite
nu le poate reproduce corect, iar acestea sunt exact lucrurile de validat.

Presupune o bază `mitmed_test` accesibilă la aceeași instanță Postgres ca
`.env` (vezi README pentru cum se creează). NU rulează niciodată împotriva
bazei de dezvoltare/producție — verifică explicit numele bazei mai jos.
"""

import os

os.environ.setdefault("ENVIRONMENT", "development")
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://mitmed:mitmed_dev_password@localhost:5433/mitmed_test"
)

if "mitmed_test" not in os.environ["DATABASE_URL"] and "test" not in os.environ["DATABASE_URL"]:
    raise RuntimeError(
        "TEST_DATABASE_URL/DATABASE_URL nu pare să indice o bază de test — opresc, ca să nu ruleze "
        "testele (care fac DROP/CREATE pe tabele) contra unei baze de dezvoltare/producție."
    )

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app, limiter

engine = create_engine(os.environ["DATABASE_URL"])
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _seed_default_clinic_hours(db_session):
    """Programul implicit folosit înainte ca orele să devină editabile de
    admin (vezi migrarea a1b2c3d4e5f7) — luni-vineri 10:00-18:00, pauză
    13:00-14:00; weekend închis. Testele existente presupun acest program;
    un test care vrea alte ore le suprascrie explicit peste acest rând."""
    from datetime import time

    from app.models import WeekdayHours

    for day in range(7):
        is_weekday = day < 5
        db_session.merge(
            WeekdayHours(
                weekday=day,
                is_open=is_weekday,
                opens_at=time(10, 0) if is_weekday else None,
                closes_at=time(18, 0) if is_weekday else None,
                break_starts_at=time(13, 0) if is_weekday else None,
                break_ends_at=time(14, 0) if is_weekday else None,
            )
        )
    db_session.commit()
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Fără asta, testele care lovesc /auth/login sau /public/booking-requests
    # de mai multe ori s-ar bloca reciproc între ele prin limita per-IP
    # (storage-ul e in-memory și persistă între teste în același proces).
    limiter.reset()
    yield


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        # Curăță toate rândurile create de test, fără să recreeze schema —
        # mult mai rapid decât drop/create per test.
        session.rollback()
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
        session.close()


@pytest.fixture
def make_client_user(db_session):
    """Creează un User+ClientProfile activ, cu parolă cunoscută de test."""
    from app.models import AccountStatus, ClientProfile, Role, User
    from app.security import hash_password

    def _make(email: str = "client@example.com", password: str = "parola123", full_name: str = "Client Test"):
        user = User(email=email, password_hash=hash_password(password), role=Role.CLIENT, status=AccountStatus.ACTIVE)
        db_session.add(user)
        db_session.flush()
        profile = ClientProfile(user_id=user.id, full_name=full_name)
        db_session.add(profile)
        db_session.commit()
        db_session.refresh(user)
        db_session.refresh(profile)
        return user, profile

    return _make


@pytest.fixture
def make_admin_user(db_session):
    from app.models import AccountStatus, Role, User
    from app.security import hash_password

    def _make(email: str = "admin@example.com", password: str = "parola123", role="ADMIN"):
        from app.models import Role as RoleEnum

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=RoleEnum[role],
            status=AccountStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture
def make_therapy(db_session):
    from app.models import Therapy

    def _make(name: str = "Kinetoterapie", duration_minutes: int = 30, price: float = 100, is_consultation: bool = False):
        therapy = Therapy(
            name=name, duration_minutes=duration_minutes, price=price, active=True, is_consultation=is_consultation
        )
        db_session.add(therapy)
        db_session.commit()
        db_session.refresh(therapy)
        return therapy

    return _make


@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    # Fără `with` (context manager) — evită rularea lifespan-ului din
    # app/main.py, care ar porni scheduler-ul APScheduler de fiecare dată
    # (instanță globală, nu suportă restart după shutdown) fără niciun
    # beneficiu pentru aceste teste.
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()
