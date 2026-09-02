# mitmed-portal

Sistem de management pentru cabinetul MitMed: login clienți, panou admin/recepție,
fișă medicală completă per client, catalog de terapii cu prețuri (inclusiv pachete
de mai multe ședințe), cupoane de reducere, plăți și programări (sincronizate cu
Google Calendar), plus un tab de insights (venituri, restanțe, performanță pe
terapie).

Aplicație **separată** de site-ul de prezentare static (`../src`, exportat static
pentru cPanel). Acesta e un Next.js dinamic — doar **frontend**; toată logica de
business și baza de date trăiesc în [`../mitmed-api`](../mitmed-api) (Python/FastAPI).

## Stack

- Next.js App Router (dinamic, fără `output: "export"`) — doar UI + Server Actions
  care apelează backend-ul
- Backend: FastAPI, în `../mitmed-api` (Python), rulat în Docker
- Autentificare: sesiune gestionată de backend (cookie httpOnly) — Next.js
  propagă cookie-ul de sesiune al browserului către API la fiecare cerere
  (`src/lib/apiClient.ts`)
- Roluri: `ADMIN` (Sebastian), `RECEPTIE`, `CLIENT`

## Pornire locală

```bash
# 1. Pornește Postgres + backend-ul Python (din rădăcina repo-ului, nu de aici)
cd .. && docker compose up -d

# 2. Rulează migrațiile + seed (o singură dată, sau după schimbări de schemă)
cd mitmed-api && source .venv/bin/activate && alembic upgrade head && python3 seed.py

# 3. Pornește Next.js
cd ../mitmed-portal
npm install
cp .env.example .env
npm run dev
```

Contul admin implicit e afișat în consolă la seed (`sebastian@mitmed.ro`) —
**schimbă parola după prima autentificare** (fără flux de "schimbă parola" încă).

## Structură

- `src/lib/apiClient.ts` — client HTTP către FastAPI; propagă cookie-ul de sesiune
  al cererii curente și, pentru login/register/logout, oglindește `Set-Cookie`
  de la API pe cookie-jar-ul Next.js (ca browserul să-l primească de la Next, nu
  direct de la API)
- `src/lib/authSession.ts` — `getCurrentUser()`/`requireRole()` (apelează
  `GET /auth/me` pe backend) + verificarea optimistă de cookie pentru `proxy.ts`
- `src/lib/enums.ts` — enum-uri partajate cu `app/models.py` din backend
- `src/actions/*` — Server Actions; fiecare apelează un endpoint FastAPI
  corespunzător (nicio logică de business sau acces la DB aici)
- `src/app/admin/*` — panou admin/recepție (Bord + calendar, Clienți, Insights,
  Terapii, Cupoane)
- `src/app/portal/*` — contul clientului

## De completat / decizii deschise

- Acces la contul Google Calendar folosit acum de Sebastian (vezi
  `../mitmed-api/.env.example`)
- Flux de resetare parolă (nu există încă)
- Mutare pe VPS: `docker-compose.yml` (la rădăcina repo-ului) conține Postgres +
  API; Next.js rulează separat (`npm run build && npm start`) sau containerizat
