import enum
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Table,
    Column,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_id() -> str:
    # Opac, suficient de random — echivalentul cuid()-urilor din schema Prisma anterioară.
    return secrets.token_urlsafe(16)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    RECEPTIE = "RECEPTIE"
    CLIENT = "CLIENT"


class AccountStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class CouponType(str, enum.Enum):
    PROCENT = "PROCENT"
    FIX = "FIX"


class AppointmentStatus(str, enum.Enum):
    PROGRAMATA = "PROGRAMATA"
    CONFIRMATA = "CONFIRMATA"
    ANULATA = "ANULATA"
    FINALIZATA = "FINALIZATA"


class PaymentStatus(str, enum.Enum):
    NEPLATIT = "NEPLATIT"
    PARTIAL = "PARTIAL"
    PLATIT = "PLATIT"


class BookingRequestStatus(str, enum.Enum):
    NOU = "NOU"
    CONFIRMAT = "CONFIRMAT"
    RESPINS = "RESPINS"


class ConsentType(str, enum.Enum):
    GDPR = "GDPR"
    RISC_PRET = "RISC_PRET"  # riscuri tratament + politică de preț/fără rambursare


coupon_therapies = Table(
    "coupon_therapies",
    Base.metadata,
    Column("coupon_id", String, ForeignKey("coupons.id", ondelete="CASCADE"), primary_key=True),
    Column("therapy_id", String, ForeignKey("therapies.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[Role] = mapped_column(SAEnum(Role, name="role"), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus, name="account_status"), nullable=False, default=AccountStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client_profile: Mapped["ClientProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship()


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    birth_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emergency_contact_name: Mapped[str | None] = mapped_column(String)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String)
    # Chestionar medical pre-consultație, completat de client: alergii,
    # afecțiuni, medicamente, leziuni anterioare etc. — structură liberă (JSON).
    medical_history: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="client_profile")
    medical_records: Mapped[list["MedicalRecord"]] = relationship(back_populates="client")
    payments: Mapped[list["Payment"]] = relationship(back_populates="client")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="client")
    consents: Mapped[list["Consent"]] = relationship(back_populates="client")


class Therapy(Base):
    __tablename__ = "therapies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    sessions_included: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    coupons: Mapped[list["Coupon"]] = relationship(secondary=coupon_therapies, back_populates="therapies")


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    type: Mapped[CouponType] = mapped_column(SAEnum(CouponType, name="coupon_type"), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    max_uses: Mapped[int | None] = mapped_column(Integer)
    uses_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    therapies: Mapped[list[Therapy]] = relationship(secondary=coupon_therapies, back_populates="coupons")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    therapy_id: Mapped[str | None] = mapped_column(String, ForeignKey("therapies.id"))
    appointment_id: Mapped[str | None] = mapped_column(String, ForeignKey("appointments.id"), index=True)
    session_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    diagnosis: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str] = mapped_column(String, nullable=False)
    # Plan de tratament/exerciții recomandate — text liber în v1 (fără bibliotecă
    # structurată de exerciții); separat semantic de `notes`, ca să poată fi
    # afișat/interogat distinct în fișa clientului.
    treatment_plan: Mapped[str | None] = mapped_column(String)
    # Diagramă corporală — listă de puncte marcate: [{"x": 0.4, "y": 0.6, "label": "..."}]
    # x/y sunt fracții (0-1) din dimensiunile siluetei, ca desenul să nu depindă de rezoluție.
    body_map: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="medical_records")
    author: Mapped[User] = relationship()
    therapy: Mapped[Therapy | None] = relationship()


class TherapyPackage(Base):
    """Pachet cu preț fix, definit de admin, care poate combina ședințe din
    mai multe terapii diferite (ex. "Pachet Recuperare" = 3× Kinetoterapie +
    2× Masaj). Vânzarea unui pachet generează câte un Payment per terapie
    inclusă (vezi routers/payments.py) — nu o entitate de plată separată —
    ca să reutilizeze neschimbat tot codul existent de urmărire a ședințelor
    (services/packages.py) și atribuirea veniturilor pe terapie (insights)."""

    __tablename__ = "therapy_packages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    items: Mapped[list["PackageItem"]] = relationship(back_populates="package", cascade="all, delete-orphan")


class PackageItem(Base):
    """O linie din "rețeta" unui pachet: X ședințe dintr-o anumită terapie."""

    __tablename__ = "package_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    package_id: Mapped[str] = mapped_column(String, ForeignKey("therapy_packages.id", ondelete="CASCADE"), index=True)
    therapy_id: Mapped[str] = mapped_column(String, ForeignKey("therapies.id"))
    sessions_included: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    package: Mapped[TherapyPackage] = relationship(back_populates="items")
    therapy: Mapped[Therapy] = relationship()


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    therapy_id: Mapped[str] = mapped_column(String, ForeignKey("therapies.id"))
    coupon_id: Mapped[str | None] = mapped_column(String, ForeignKey("coupons.id"))
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    final_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status"), nullable=False, default=PaymentStatus.NEPLATIT
    )
    method: Mapped[str | None] = mapped_column(String)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    appointment_id: Mapped[str | None] = mapped_column(String, ForeignKey("appointments.id"), unique=True)
    # Instantaneu al therapy.sessions_included la cumpărare — null = ședință unică.
    package_total_sessions: Mapped[int | None] = mapped_column(Integer)
    sessions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Setate doar când acest rând provine dintr-un pachet multi-terapie (nu la
    # o ședință unică/pachet mono-terapie clasic, unde rămân null). Un singur
    # pachet cumpărat generează CÂTE UN Payment per terapie inclusă — toate
    # cu același package_purchase_id — ca să poată fi grupate în UI ca "o
    # singură achiziție", deși consumul de ședințe (package_total_sessions/
    # sessions_used de mai sus) funcționează identic ca la o terapie simplă.
    package_id: Mapped[str | None] = mapped_column(String, ForeignKey("therapy_packages.id"), index=True)
    package_purchase_id: Mapped[str | None] = mapped_column(String, index=True)

    client: Mapped[ClientProfile] = relationship(back_populates="payments")
    therapy: Mapped[Therapy] = relationship()
    coupon: Mapped[Coupon | None] = relationship()
    package: Mapped[TherapyPackage | None] = relationship()


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    therapy_id: Mapped[str] = mapped_column(String, ForeignKey("therapies.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus, name="appointment_status"), nullable=False, default=AppointmentStatus.PROGRAMATA
    )
    google_calendar_event_id: Mapped[str | None] = mapped_column(String)
    created_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    # Setat de job-ul periodic de remindere (app/services/notifications.py) —
    # evită trimiterea de remindere duplicate pentru aceeași programare.
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="appointments")
    therapy: Mapped[Therapy] = relationship()


class ConsentTemplate(Base):
    """Textul curent al fiecărui tip de declarație — editabil de ADMIN. Când un
    client semnează, textul curent se copiază (snapshot) pe Consent.version_text,
    ca o editare ulterioară a template-ului să nu schimbe retroactiv ce a semnat
    cineva deja."""

    __tablename__ = "consent_templates"

    type: Mapped[ConsentType] = mapped_column(SAEnum(ConsentType, name="consent_type"), primary_key=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Consent(Base):
    """Declarație semnată digital de client (semnătură pe canvas) — GDPR sau
    riscuri de tratament + politică de preț."""

    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    type: Mapped[ConsentType] = mapped_column(SAEnum(ConsentType, name="consent_type"), nullable=False)
    version_text: Mapped[str] = mapped_column(String, nullable=False)
    signature_data_url: Mapped[str] = mapped_column(String, nullable=False)  # PNG base64 din canvas
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="consents")


class PublicBookingRequest(Base):
    """Cerere de programare de la un vizitator fără cont (widget de pe site-ul
    de prezentare) — recepția o confirmă manual, transformând-o într-un cont +
    o programare reală, ca să evităm crearea automată de conturi din surse
    nesigure."""

    __tablename__ = "public_booking_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String)
    therapy_id: Mapped[str | None] = mapped_column(String, ForeignKey("therapies.id"))
    preferred_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str | None] = mapped_column(String)
    status: Mapped[BookingRequestStatus] = mapped_column(
        SAEnum(BookingRequestStatus, name="booking_request_status"),
        nullable=False,
        default=BookingRequestStatus.NOU,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    therapy: Mapped[Therapy | None] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    actor_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    target_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    audit_metadata: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
