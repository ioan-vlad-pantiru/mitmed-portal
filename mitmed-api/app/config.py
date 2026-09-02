from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
    seed_admin_password: str = "SchimbaMaLaPrimaAutentificare1!"

    # SMS/WhatsApp remindere — no-op (doar logare) până se completează un
    # provider. Twilio e implementat ca exemplu; poate fi înlocuit ușor cu
    # orice gateway SMS românesc care oferă un API HTTP similar.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    # Fereastra (ore) înainte de programare la care se trimite reminderul.
    reminder_hours_before: int = 24

    # URL-ul de recenzii Google (Maps) — folosit pt. nudge-ul de recenzie din portal.
    google_review_url: str | None = None


settings = Settings()
