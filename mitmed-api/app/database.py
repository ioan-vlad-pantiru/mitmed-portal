from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Rutele sunt sincrone, deci FastAPI le rulează pe un threadpool de 40 de fire.
# Dacă pool-ul are mai puține conexiuni decât firele, la o rafală de cereri
# firele rămân blocate așteptând o conexiune, iar eliberarea conexiunilor (care
# are și ea nevoie de un fir) nu mai apucă să ruleze — API-ul se blochează
# minute întregi (incidentul din 11 nov 2026). 20 + 30 = 50 > 40 fire + jobul
# de remindere, mult sub max_connections=100 din Postgres.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
    pool_timeout=10,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[Session, None]:
    # `async` intenționat: FastAPI rulează curățarea unei dependențe sincrone tot
    # pe threadpool, așa că la o rafală conexiunea rămânea ocupată până se
    # elibera un fir. Pe event loop, `close()` rulează imediat și conexiunea se
    # întoarce în pool. Sesiunea e lazy — se conectează abia la primul query,
    # din firul rutei — deci nu blocăm event loop-ul la deschidere.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
