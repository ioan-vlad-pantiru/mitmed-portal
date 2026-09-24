import enum
import secrets
from datetime import date as date_, datetime, time as time_, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Table,
    Time,
    Column,
    text,
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


class DataRequestType(str, enum.Enum):
    EXPORT = "EXPORT"
    ERASURE = "ERASURE"


class DataRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


coupon_therapies = Table(
    "coupon_therapies",
    Base.metadata,
    Column("coupon_id", String, ForeignKey("coupons.id", ondelete="CASCADE"), primary_key=True),
    Column("therapy_id", String, ForeignKey("therapies.id", ondelete="CASCADE"), primary_key=True),
)

# Terapiile pe care un medic le-a "deblocat" pentru un anumit client, de
# obicei după consultația inițială — vezi ClientProfile.unlocked_therapies.
client_unlocked_therapies = Table(
    "client_unlocked_therapies",
    Base.metadata,
    Column("client_id", String, ForeignKey("client_profiles.id", ondelete="CASCADE"), primary_key=True),
    Column("therapy_id", String, ForeignKey("therapies.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    email: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[Role] = mapped_column(SAEnum(Role, name="role"), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus, name="account_status"), nullable=False, default=AccountStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Blocare temporară a contului după autentificări eșuate repetate — vezi
    # app/security.py:register_failed_login / register_successful_login.
    # Ținută în DB (nu în memorie) ca să reziste la restart și la mai multe
    # instanțe API.
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

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
    # Cod numeric personal — identificatorul pacientului pe fișa medicală.
    # Completat doar de personal (admin/recepție), validat la salvare.
    cnp: Mapped[str | None] = mapped_column(String(13))
    emergency_contact_name: Mapped[str | None] = mapped_column(String)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String)
    # Chestionar medical pre-consultație, completat de client: alergii,
    # afecțiuni, medicamente, leziuni anterioare etc. — structură liberă (JSON).
    medical_history: Mapped[dict | None] = mapped_column(JSON)
    # Date opționale de profil folosite pentru comunicare și statistici
    # agregate. Sunt ținute separat de istoricul medical, ca să nu ajungă
    # din greșeală în rapoarte de marketing/operare.
    profile_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="client_profile")
    medical_records: Mapped[list["MedicalRecord"]] = relationship(back_populates="client")
    payments: Mapped[list["Payment"]] = relationship(back_populates="client")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="client")
    consents: Mapped[list["Consent"]] = relationship(back_populates="client")
    # Terapii pe care clientul le poate rezerva singur din portal, dincolo de
    # consultație — deblocate manual de medic după ce a văzut clientul. Gol
    # pentru un client nou: poate rezerva doar o terapie marcată `is_consultation`.
    unlocked_therapies: Mapped[list["Therapy"]] = relationship(secondary=client_unlocked_therapies)
    fidelity_cards: Mapped[list["ClientFidelityCard"]] = relationship(back_populates="client")
    consultation_sheets: Mapped[list["ConsultationSheet"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


class Therapy(Base):
    __tablename__ = "therapies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # O terapie marcată astfel e mereu rezervabilă de orice client din portal,
    # indiferent de lista de terapii deblocate — e "consultația" (sau o altă
    # ședință de evaluare) prin care un client nou intră în sistem. Rămâne o
    # terapie obișnuită din punct de vedere al prețului/duratei, editabilă de
    # admin la fel ca oricare alta.
    is_consultation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
    # Structură SOAP pentru documentarea clinică. `notes` rămâne rezumatul
    # ședinței/intervențiilor pentru compatibilitate și pentru afișarea în dosarul clientului.
    subjective: Mapped[str | None] = mapped_column(String)
    objective: Mapped[str | None] = mapped_column(String)
    assessment: Mapped[str | None] = mapped_column(String)
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


class ConsultationSheet(Base):
    """Fișa de consultații și evaluări medicale (formularul pe hârtie al cabinetului).

    Completată la prima vizită și la reconsult (~6 luni). Datele de identitate
    (nume, CNP, domiciliu, ocupație, telefon) rămân pe ClientProfile — fișa le
    afișează, nu le duplică.
    """

    __tablename__ = "consultation_sheets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    sheet_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sheet_number: Mapped[str | None] = mapped_column(String(30))
    marital_status: Mapped[str | None] = mapped_column(String(50))
    antecedents: Mapped[str | None] = mapped_column(String)
    working_conditions: Mapped[str | None] = mapped_column(String)
    blood_pressure: Mapped[str | None] = mapped_column(String(30))
    pulse: Mapped[str | None] = mapped_column(String(30))
    oxygen_saturation: Mapped[str | None] = mapped_column(String(30))
    glycemia: Mapped[str | None] = mapped_column(String(30))
    symptoms: Mapped[str | None] = mapped_column(String)
    diagnosis: Mapped[str | None] = mapped_column(String)
    recommendations: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="consultation_sheets")
    author: Mapped[User] = relationship()


class ClientDocument(Base):
    __tablename__ = "client_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    uploaded_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Cale relativă la settings.upload_dir — vezi app/services/file_storage.py.
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TherapyPackage(Base):
    """Variantă de pachet (ex. "Pachet Standard" -10%, "Pachet Premium" -20%),
    definită de admin doar prin numele ei și procentul de reducere. Terapiile
    incluse și numărul de ședințe rămân complet libere (medicul le alege la
    vânzare) — prețul nu mai e tastat manual, ci calculat automat din suma
    prețurilor de listă ale terapiilor incluse, cu reducerea aplicată (vezi
    proprietatea `price`). Vânzarea unui pachet generează câte un Payment per
    terapie inclusă (vezi routers/payments.py) — nu o entitate de plată
    separată — ca să reutilizeze neschimbat tot codul existent de urmărire a
    ședințelor (services/packages.py) și atribuirea veniturilor pe terapie
    (insights)."""

    __tablename__ = "therapy_packages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    items: Mapped[list["PackageItem"]] = relationship(back_populates="package", cascade="all, delete-orphan")

    @property
    def list_price(self) -> float:
        """Suma prețurilor de listă ale terapiilor incluse, fără reducere."""
        return sum(float(i.therapy.price) * i.sessions_included for i in self.items)

    @property
    def price(self) -> float:
        """Preț final, calculat automat — nu se mai tastează manual."""
        return round(self.list_price * (1 - float(self.discount_percent) / 100), 2)


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
    # Cât s-a încasat efectiv până acum — poate fi mai mic decât final_price
    # (plată parțială) sau egal cu el (achitat integral). status e derivat
    # din compararea celor două, vezi routers/payments.py:_status_for_amount.
    # Nu ținem un istoric al încasărilor individuale (doar suma cumulată) —
    # suficient pentru "cât mai are de plată", nu un registru contabil.
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    # Defalcarea lui amount_paid pe cele două metode, când o încasare a fost
    # împărțită parte numerar/parte card (vezi routers/payments.py:mark_payment_paid) —
    # doar informativ, pentru chitanță/export contabil; amount_paid rămâne
    # sursa de adevăr pentru "cât s-a încasat în total".
    amount_paid_cash: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    amount_paid_card: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status"), nullable=False, default=PaymentStatus.NEPLATIT
    )
    method: Mapped[str | None] = mapped_column(String)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    appointment_id: Mapped[str | None] = mapped_column(String, ForeignKey("appointments.id"), unique=True)
    # Setat doar când plata provine dintr-un pachet (vezi PackageItem.sessions_included
    # la momentul cumpărării) — o terapie cumpărată individual e mereu ședință unică,
    # orice "cumpăr N ședințe" trece obligatoriu prin /admin/pachete.
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

    # ID-ul comenzii PayU — setat la inițierea plății online (routers/payments.py)
    # și reconfirmat din webhook (routers/webhooks.py) la finalizare. Util pentru
    # a corela o plată cu tranzacția din panoul PayU în caz de dispută.
    payu_order_id: Mapped[str | None] = mapped_column(String)

    # Setat doar când acest Payment reprezintă o ședință gratuită, obținută
    # prin răsplata unui card de fidelitate (vezi ClientFidelityCard) — nu
    # trebuie plătit și nu contează el însuși ca "ștampilă" spre următoarea
    # răsplată (altfel s-ar autoalimenta la nesfârșit).
    fidelity_card_id: Mapped[str | None] = mapped_column(String, ForeignKey("client_fidelity_cards.id"))

    client: Mapped[ClientProfile] = relationship(back_populates="payments")
    therapy: Mapped[Therapy] = relationship()
    coupon: Mapped[Coupon | None] = relationship()
    package: Mapped[TherapyPackage | None] = relationship()
    fidelity_card: Mapped["ClientFidelityCard | None"] = relationship()


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
    # Setate de job-ul periodic de remindere (app/scheduler.py) — două
    # remindere distincte per programare (cu o zi înainte, cu o oră înainte),
    # fiecare cu propriul flag, ca să nu se trimită duplicat.
    reminder_day_before_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminder_hour_before_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="appointments")
    therapy: Mapped[Therapy] = relationship()

    __table_args__ = (
        # Interzice două programări ACTIVE pe aceeași terapie + oră exactă la
        # nivel de bază de date — ultima linie de apărare împotriva
        # dublei-rezervări sub concurență, independent de verificarea de
        # disponibilitate din routers/appointments.py (care are o fereastră
        # citire-apoi-scriere ce se poate pierde la două cereri simultane).
        # Terapiile diferite se pot suprapune intenționat (mai mulți
        # terapeuți) — de-asta indexul e pe (therapy_id, starts_at), nu doar
        # pe starts_at.
        Index(
            "ux_appointments_active_slot",
            "therapy_id",
            "starts_at",
            unique=True,
            postgresql_where=text("status IN ('PROGRAMATA', 'CONFIRMATA')"),
        ),
    )


class ConsentTemplate(Base):
    """Un TIP de declarație de semnat (ex. GDPR, risc/preț) + textul lui curent,
    editabile de ADMIN. Tipul nu mai e un enum fix — admin poate adăuga oricând
    un tip nou (ex. "Acord vaccinare") din /admin/documente. `type` rămâne un
    identificator opac (slug), `label` e numele afișat clientului/adminului.
    Un tip se dezactivează (nu se șterge) când nu mai e folosit, ca declarațiile
    deja semnate să-și păstreze legătura cu tipul lor original. Când un client
    semnează, textul curent se copiază (snapshot) pe Consent.version_text, ca o
    editare ulterioară a template-ului să nu schimbe retroactiv ce a semnat
    cineva deja."""

    __tablename__ = "consent_templates"

    type: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Scop GDPR al acestui document — informativ, folosit pentru afișare și
    # pentru a decide dacă retragerea are sens (tratament vs. opțional).
    # Nu schimbă nimic la nivel de bază de date pentru documentele existente
    # (rămân "TRATAMENT" implicit — GDPR/RISC_PRET erau deja consimțăminte
    # legate direct de acordarea tratamentului).
    category: Mapped[str] = mapped_column(String, nullable=False, default="TRATAMENT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Consent(Base):
    """Declarație semnată digital de client (semnătură pe canvas), pentru
    oricare tip definit în ConsentTemplate."""

    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    version_text: Mapped[str] = mapped_column(String, nullable=False)
    signature_data_url: Mapped[str] = mapped_column(String, nullable=False)  # PNG base64 din canvas
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Retragere (GDPR Art. 7(3)) — nu șterge rândul (dovada semnăturii inițiale
    # trebuie păstrată), doar marchează din ce moment consimțământul nu mai e
    # valabil. Nu afectează legalitatea prelucrării de dinainte de retragere.
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

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


class DataSubjectRequest(Base):
    """Cerere GDPR (Art. 15 export / Art. 17 ștergere) înregistrată de client
    din portal. Exportul se generează imediat (self-service); ștergerea
    necesită execuție manuală de admin, fiindcă fișele medicale/financiare
    trebuie păstrate conform obligațiilor legale de arhivare (nu pot fi șterse
    orbește doar pentru că clientul a cerut) — vezi routers/clients.py."""

    __tablename__ = "data_subject_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    type: Mapped[DataRequestType] = mapped_column(SAEnum(DataRequestType, name="data_request_type"), nullable=False)
    status: Mapped[DataRequestStatus] = mapped_column(
        SAEnum(DataRequestStatus, name="data_request_status"), nullable=False, default=DataRequestStatus.PENDING
    )
    note: Mapped[str | None] = mapped_column(String)
    resolved_by_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    client: Mapped[ClientProfile] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    actor_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    target_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    audit_metadata: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeekdayHours(Base):
    """Programul cabinetului pentru o zi din săptămână — un rând per zi
    (0=luni…6=duminică, la fel ca `date.weekday()`, ca să nu fie nevoie de
    nicio conversie față de restul codului). Când `is_open` e fals, cabinetul
    e închis în acea zi indiferent de orele completate. Pauza (break_*) e
    opțională — None înseamnă "fără pauză" în acea zi."""

    __tablename__ = "weekday_hours"

    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    opens_at: Mapped[time_ | None] = mapped_column(Time)
    closes_at: Mapped[time_ | None] = mapped_column(Time)
    break_starts_at: Mapped[time_ | None] = mapped_column(Time)
    break_ends_at: Mapped[time_ | None] = mapped_column(Time)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ClinicVacation(Base):
    """O perioadă (inclusiv capetele) în care cabinetul e complet închis —
    concediu, sărbători etc. Blochează programările noi (client sau recepție)
    în acel interval; nu atinge programările deja existente, care se
    gestionează manual (anulare/reprogramare) dacă e cazul."""

    __tablename__ = "clinic_vacations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    starts_on: Mapped[date_] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date_] = mapped_column(Date, nullable=False)
    label: Mapped[str | None] = mapped_column(String)
    created_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FidelityCardType(Base):
    """Un TIP de card de fidelitate ("cartelă"), definit de admin — ce
    terapie contorizează și ce reducere se aplică la a N-a ședință PLĂTITĂ
    (vezi FidelityCardTier: ex. a 5-a ședință -25%, a 6-a -50%). Complet
    editabil de admin — nume, terapie, tot programul de trepte; un tip se
    dezactivează (nu se șterge) dacă a fost deja emis unui client, ca
    istoricul cardurilor emise să rămână coerent."""

    __tablename__ = "fidelity_card_types"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    therapy_id: Mapped[str] = mapped_column(String, ForeignKey("therapies.id"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    therapy: Mapped[Therapy] = relationship()
    tiers: Mapped[list["FidelityCardTier"]] = relationship(
        back_populates="card_type", cascade="all, delete-orphan", order_by="FidelityCardTier.session_number"
    )

    @property
    def cycle_length(self) -> int:
        """Numărul de ședințe după care programul de trepte se reia de la
        capăt — cea mai mare treaptă definită. Un card fără trepte n-are
        niciodată reducere automată."""
        return max((t.session_number for t in self.tiers), default=0)


class FidelityCardTier(Base):
    """O treaptă a programului de fidelitate: la a `session_number`-a
    ședință PLĂTITĂ din ciclul curent, se aplică `discount_percent`. Ex:
    session_number=5, discount_percent=25 + session_number=6,
    discount_percent=50 — "a 5-a ședință -25%, a 6-a -50%". Programul se
    reia ciclic după cea mai mare treaptă (vezi FidelityCardType.cycle_length
    și services/fidelity.py)."""

    __tablename__ = "fidelity_card_tiers"
    __table_args__ = (
        Index("ux_fidelity_card_tiers_type_session", "card_type_id", "session_number", unique=True),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    card_type_id: Mapped[str] = mapped_column(String, ForeignKey("fidelity_card_types.id", ondelete="CASCADE"), index=True)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    card_type: Mapped[FidelityCardType] = relationship(back_populates="tiers")


class ClientFidelityCard(Base):
    """Un card EMIS unui client anume, dintr-un FidelityCardType. Un client
    poate avea mai multe carduri simultan (ex. unul per terapie). `stamps`
    urmărește poziția în ciclul curent (0 = următoarea ședință e prima din
    ciclu) — vezi services/fidelity.py pentru logica de acumulare/reducere."""

    __tablename__ = "client_fidelity_cards"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    card_type_id: Mapped[str] = mapped_column(String, ForeignKey("fidelity_card_types.id"), nullable=False)
    issued_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Ședințe plătite acumulate în ciclul curent — se reia de la 0 după ce
    # atinge FidelityCardType.cycle_length (întreținut de services/fidelity.py).
    stamps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Contor istoric, doar informativ — de câte ori a primit o reducere prin
    # acest card, nu afectează logica de calcul.
    discounted_sessions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    client: Mapped[ClientProfile] = relationship(back_populates="fidelity_cards")
    card_type: Mapped[FidelityCardType] = relationship()
    issued_by: Mapped[User] = relationship()


class PendingRegistration(Base):
    """Auto-înregistrare în așteptarea verificării telefonului prin SMS — nu
    devine User/ClientProfile până nu se confirmă codul primit prin SMS.
    Ținută separat (nu direct pe User) ca un cod niciodată introdus să nu
    lase un cont orfan/neverificat în tabela principală. Un singur rând activ
    per telefon — o cerere nouă de cod pentru același telefon suprascrie
    datele vechi (nume/parolă pot fi corectate la o a doua încercare)."""

    __tablename__ = "pending_registrations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    phone: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    birth_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Hash-ul codului de 6 cifre (nu textul clar) — verificat cu aceeași
    # funcție argon2 ca parolele, vezi app/security.py.
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
