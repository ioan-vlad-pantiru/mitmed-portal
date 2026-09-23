// Enum-uri partajate cu backend-ul Python (app/models.py) — valorile trebuie
// să rămână identice string-cu-string pe ambele părți.

export const Role = { ADMIN: "ADMIN", RECEPTIE: "RECEPTIE", CLIENT: "CLIENT" } as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Singura categorie de ConsentTemplate retractabilă de client — consimțământul
 * de prelucrare a datelor (GDPR Art. 7(3)). Restul (risc/preț, alte acorduri
 * de tratament) nu sunt un "consimțământ" în sensul GDPR — vezi și
 * backend-ul (routers/consents.py:WITHDRAWABLE_CATEGORY), care aplică
 * aceeași regulă, nu doar ascunde butonul aici. */
export const WITHDRAWABLE_CATEGORY = "PRELUCRARE_DATE";

export const AccountStatus = { PENDING: "PENDING", ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED" } as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const CouponType = { PROCENT: "PROCENT", FIX: "FIX" } as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const AppointmentStatus = {
  PROGRAMATA: "PROGRAMATA",
  CONFIRMATA: "CONFIRMATA",
  ANULATA: "ANULATA",
  FINALIZATA: "FINALIZATA",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const PaymentStatus = { NEPLATIT: "NEPLATIT", PARTIAL: "PARTIAL", PLATIT: "PLATIT" } as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
