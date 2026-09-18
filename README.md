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

## Pornire cu Docker

Pornește întregul stack (Postgres, API și portal):

```bash
docker compose up --build
```

Portalul este disponibil la `http://localhost:3000`, iar documentația API la
`http://localhost:8000/docs`. La fiecare pornire, containerul API aplică în
siguranță migrațiile Alembic, inclusiv câmpurile opționale de profil client.

Pentru prima rulare, creează administratorul într-un terminal separat:

```bash
docker compose exec api python seed.py
```

Oprește serviciile cu `docker compose down`. Baza de date rămâne în volumul
`mitmed_portal_db`; pentru a o șterge intenționat folosește `docker compose down -v`.

## Dezvoltare fără container pentru frontend

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
