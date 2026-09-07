# mitmed-portal

Sistemul de management pentru cabinetul MitMed (Onești) — portal client/admin
și API-ul care îl susține. Separat de site-ul de prezentare (mitmed.ro), care
locuiește în [repo-ul `mitmed`](https://github.com/ioan-vlad-pantiru/mitmed).

## Structură

- [`mitmed-portal/`](mitmed-portal) — front-end Next.js (programări, fișe
  clienți, terapii/pachete, cupoane, facturare, insights)
- [`mitmed-api/`](mitmed-api) — back-end FastAPI (autentificare, logica de
  business, acces la baza de date)
- `docker-compose.yml` — Postgres + API-ul, pentru dezvoltare locală

## Pornire locală

```bash
# Postgres + API
docker compose up -d
cd mitmed-api && cp .env.example .env
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
alembic upgrade head && python3 seed.py

# Front-end
cd ../mitmed-portal && npm install && npm run dev
```

Detalii complete în README-ul fiecărui sub-proiect.
