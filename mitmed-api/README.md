# mitmed-api

Backend Python (FastAPI) pentru [`../mitmed-portal`](../mitmed-portal) — toată
logica de business, autentificarea și accesul la baza de date pentru sistemul
de management MitMed. Next.js e doar interfața; acest serviciu e sursa de
adevăr pentru date.

## Stack

- FastAPI + SQLAlchemy 2.0 + Alembic (migrații)
- PostgreSQL (containerizat, vezi `../docker-compose.yml`)
- Autentificare: sesiuni în DB + cookie httpOnly (`mitmed_session`), parole cu Argon2
- Rulează în Docker (`Dockerfile` + serviciul `api` din compose-ul de la rădăcină)

## Pornire locală

```bash
# Din rădăcina repo-ului: pornește Postgres + acest API
cd .. && docker compose up -d

# Prima dată (sau după schimbări de schemă): migrații + date inițiale
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python3 seed.py
```

API-ul e disponibil pe `http://localhost:8000` (documentație interactivă pe
`/docs`). Contul admin implicit + parola sunt afișate în consolă la seed.

## Structură

- `app/models.py` — modele SQLAlchemy (oglindesc fostul schema.prisma)
- `app/security.py` — hash parole (Argon2) + creare/ștergere sesiune
- `app/deps.py` — dependințe FastAPI: `get_current_user`, `require_roles(...)`
- `app/services/pricing.py` — calculul prețului cu cupon
- `app/services/packages.py` — scăderea automată a ședințelor dintr-un pachet
  cumpărat, la fiecare notiță de ședință scrisă
- `app/services/google_calendar.py` — sincronizare programări → Google Calendar
  (no-op până se completează `GOOGLE_CALENDAR_*` în `.env`)
- `app/routers/*` — un router per resursă (auth, clients, therapies, coupons,
  medical_records, payments, appointments, insights)
- `alembic/versions/` — migrații

## Migrații noi

```bash
alembic revision --autogenerate -m "descriere"
alembic upgrade head
```

Verifică mereu fișierul generat înainte de a rula `upgrade` — autogenerate nu e
infailibil (ex: ordinea de drop pe FK-uri circulare trebuie uneori ajustată manual).
