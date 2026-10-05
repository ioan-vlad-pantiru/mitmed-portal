from pydantic_settings import BaseSettings, SettingsConfigDict

# Valoarea implicită de cod pentru parola de seed a adminului — NU pentru
# folosire reală. Există doar ca fallback în dev; la pornirea în producție,
# app/main.py verifică explicit dacă a fost schimbată în .env și refuză să
# pornească dacă nu a fost (altfel un deploy cu .env incomplet ar publica un
# cont admin cu parolă cunoscută public, pe un sistem cu date medicale).
DEFAULT_SEED_ADMIN_PASSWORD = "SchimbaMaLaPrimaAutentificare1!"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" | "production" — controlează verificările stricte de la
    # pornire (ex. parola de seed). Setați explicit ENVIRONMENT=production în
    # .env-ul de pe VPS.
    environment: str = "development"

    database_url: str = "postgresql+psycopg://mitmed:mitmed_dev_password@localhost:5433/mitmed_portal"
    session_cookie_name: str = "mitmed_session"
    session_duration_days: int = 7
    # False în dev (HTTP local); pune True pe VPS, unde totul e servit prin HTTPS.
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    # Google Calendar (sincronizare programări) — opțional, vezi app/services/google_calendar.py
    google_calendar_client_email: str | None = None
    google_calendar_private_key: str | None = None
    google_calendar_calendar_id: str | None = None

    seed_admin_email: str = "sebastian@mitmed.ro"
    seed_admin_password: str = DEFAULT_SEED_ADMIN_PASSWORD

    # WhatsApp Business Cloud API (Meta) — webhook /webhooks/whatsapp.
    # `verify_token`: șirul ales de noi în App Dashboard > WhatsApp >
    # Configuration; `app_secret`: App settings > Basic (semnează POST-urile).
    whatsapp_verify_token: str | None = None
    whatsapp_app_secret: str | None = None
    # Trimitere (remindere, coduri de înregistrare) — no-op (doar logare) până
    # se completează. `phone_number_id`: App Dashboard > WhatsApp > API Setup;
    # `access_token`: token permanent de System User (Business Settings), cu
    # permisiunea whatsapp_business_messaging.
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_graph_api_version: str = "v23.0"
    whatsapp_template_language: str = "ro"
    whatsapp_otp_template: str = "mitmed_otp"
    whatsapp_reminder_template: str = "mitmed_reminder"
    whatsapp_cancellation_template: str = "mitmed_cancellation"
    # Telefonul medicului — primește pe WhatsApp un mesaj când un client își
    # anulează singur programarea din portal. Gol = nu se trimite nimic.
    staff_notify_phone: str | None = None
    # Ferestrele (ore) înainte de programare la care se trimite câte un
    # reminder — două remindere distincte per programare, nu unul singur.
    reminder_day_before_hours: int = 24
    reminder_hour_before_hours: int = 1

    # Adresa cabinetului și link-ul de orientare Google Maps (trimis în remindere).
    clinic_address: str = "Bulevardul Oituz 18, Parter, Ap 58, Onești"
    clinic_directions_url: str = (
        # Fișa Google Business a cabinetului (cid) — pinul exact din Google Maps.
        "https://maps.google.com/?cid=14134451368250057260"
    )

    # URL-ul de recenzii Google (Maps) — folosit pt. nudge-ul de recenzie din portal.
    google_review_url: str | None = None

    # Plată online (PayU Romania) — vezi app/services/payu.py. Fără
    # payu_pos_id/payu_client_secret/payu_second_key completate, endpoint-ul
    # de checkout refuză cererea în loc să eșueze tăcut.
    payu_base_url: str = "https://secure.snd.payu.com"  # sandbox implicit; https://secure.payu.com în producție
    payu_pos_id: str | None = None
    payu_client_secret: str | None = None
    # "A doua cheie" (MD5) din panoul de comerciant PayU — folosită DOAR la
    # verificarea semnăturii notificărilor primite pe /webhooks/payu, nu la
    # autentificarea OAuth (care folosește payu_client_secret).
    payu_second_key: str | None = None
    # URL public al API-ului, pentru notifyUrl trimis la PayU — trebuie să fie
    # accesibil din internet (nu doar din rețeaua Docker internă), altfel PayU
    # nu poate confirma plata. În dev local, tunelează cu ngrok și pune URL-ul
    # de acolo aici.
    public_api_base_url: str = "http://localhost:8000"
    # URL-ul portalului, pentru redirecționarea clientului înapoi după plată.
    portal_base_url: str = "http://localhost:3000"

    # Director pentru documentele atașate fișei clientului (vezi
    # app/services/file_storage.py) — cale relativă în dev/teste, creat la nevoie;
    # în Docker e suprascris cu un volum montat (vezi docker-compose.yml).
    upload_dir: str = "uploads"


settings = Settings()
