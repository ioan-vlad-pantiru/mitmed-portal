/** Small calculations shared by the client portal pages. */

const ACTIVE_STATUSES = new Set(["PROGRAMATA", "CONFIRMATA"]);

type AppointmentLike = { status: string; starts_at: string };
type PaymentLike = { status: string; final_price: string; amount_paid: string };

/** Booked or confirmed visits that haven't started yet, soonest first. */
export function upcomingAppointments<T extends AppointmentLike>(appointments: T[], now: number): T[] {
  return appointments
    .filter((a) => ACTIVE_STATUSES.has(a.status) && new Date(a.starts_at).getTime() >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
}

/** What is still left to pay on one payment line. */
export function amountDue(payment: PaymentLike): number {
  return Number(payment.final_price) - Number(payment.amount_paid);
}

export function unpaidPayments<T extends PaymentLike>(payments: T[]): T[] {
  return payments.filter((p) => p.status !== "PLATIT");
}

/** Consent templates the client hasn't signed yet. */
export function unsignedTemplates<T extends { type: string }>(templates: T[], consents: { type: string }[]): T[] {
  const signed = new Set(consents.map((c) => c.type));
  return templates.filter((t) => !signed.has(t.type));
}

export type SharedNote = { label: string; value: string };
export type ClientRecord = {
  id: string;
  session_date: string;
  diagnosis: string | null;
  notes: string;
  treatment_plan: string | null;
  therapy: { name: string } | null;
  shared: SharedNote[];
};
export type ClientSheet = { id: string; sheet_date: string; sheet_number: string | null; template_name: string; shared: SharedNote[] };

/** One entry of "Dosarul meu": a treatment session or a sheet, in date order. */
export type FileEntry =
  | { kind: "record"; date: string; record: ClientRecord }
  | { kind: "sheet"; date: string; sheet: ClientSheet };

export function medicalFileEntries(records: ClientRecord[], sheets: ClientSheet[]): FileEntry[] {
  return [
    ...records.map((record) => ({ kind: "record" as const, date: record.session_date, record })),
    ...sheets.map((sheet) => ({ kind: "sheet" as const, date: sheet.sheet_date, sheet })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

const isRecommendation = (note: SharedNote) => /recomand/i.test(note.label);

/** The most recent advice the client got: a session's plan or a sheet's "Recomandări". */
export function latestAdvice(records: ClientRecord[], sheets: ClientSheet[]): { date: string; source: string; text: string } | null {
  for (const entry of medicalFileEntries(records, sheets)) {
    if (entry.kind === "record") {
      const text = entry.record.treatment_plan ?? entry.record.shared.find(isRecommendation)?.value;
      if (text) return { date: entry.date, source: entry.record.therapy?.name ?? "Ședință", text };
    } else {
      const text = entry.sheet.shared.find(isRecommendation)?.value;
      if (text) return { date: entry.date, source: entry.sheet.template_name, text };
    }
  }
  return null;
}
