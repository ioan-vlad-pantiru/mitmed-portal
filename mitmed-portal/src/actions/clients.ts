"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, apiPostForm, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ClientSummary = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
};

export type PendingUser = { id: string; email: string | null; full_name: string | null };

/** Admin/recepție: listă completă de clienți, cu statusul contului. */
export async function listClients(): Promise<ClientSummary[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ClientSummary[]>("/clients");
}

/** Conturile create prin auto-înregistrare, în așteptarea aprobării. */
export async function listPendingClients(): Promise<PendingUser[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<PendingUser[]>("/clients/pending");
}

export async function approveClient(userId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/clients/${userId}/approve`);
  revalidatePath("/admin/clienti");
}

export async function suspendClient(userId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/clients/${userId}/suspend`);
  revalidatePath("/admin/clienti");
}

/** Generează o parolă temporară nouă — de comunicat manual clientului
 * (telefon/WhatsApp). Nu există încă un flux self-service "am uitat parola". */
export async function resetClientPassword(userId: string): Promise<string> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const result = await apiPost<{ new_password: string }>(`/clients/${userId}/reset-password`);
  return result.new_password;
}

export type CreateAccountFormState =
  | {
      message?: string;
      success?: boolean;
      // Ecou al câmpurilor nesensibile trimise, ca formularul să se poată
      // repopula după o eroare (ex: parolă prea scurtă) fără să oblige
      // admin/recepția să retape numele/emailul/telefonul. Parola NU se
      // ecouă niciodată înapoi.
      values?: { fullName?: string; email?: string; phone?: string };
    }
  | undefined;

/** Recepție/admin creează manual un cont de client (deja activ). */
export async function createClientAccount(
  _state: CreateAccountFormState,
  formData: FormData
): Promise<CreateAccountFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const values = { fullName, email, phone };

  if (fullName.length < 2 || !phone || password.length < 8) {
    return { message: "Completează toate câmpurile obligatorii (telefonul, parola: minim 8 caractere).", values };
  }

  try {
    await apiPost("/clients", { full_name: fullName, email: email || null, phone, password });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message, values };
    throw err;
  }

  revalidatePath("/admin/clienti");
  return { success: true, message: "Cont client creat și activ." };
}

/** Fișa completă a unui client — profil, fișe medicale, plăți, programări. */
export async function getClientDetail(clientProfileId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    return await apiGet<Record<string, unknown>>(`/clients/${clientProfileId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Read-only: propria fișă a clientului autentificat (fără date medicale ale altcuiva). */
export async function getOwnClientData() {
  try {
    return await apiGet<Record<string, unknown>>("/clients/me");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export type NotesFormState = { message?: string; success?: boolean } | undefined;

/** Note interne despre client (context, preferințe, ce trebuie reținut) —
 * vizibile doar personalului, niciodată clientului. */
export async function updateClientNotes(
  clientProfileId: string,
  _state: NotesFormState,
  formData: FormData
): Promise<NotesFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const notes = String(formData.get("notes") ?? "");
  try {
    await apiPatch(`/clients/${clientProfileId}/notes`, { notes });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientProfileId}`);
  return { success: true, message: "Note salvate." };
}

export type UnlockedTherapiesFormState = { message?: string; success?: boolean } | undefined;

/** Terapiile deblocate manual de medic pentru un client — de obicei imediat
 * după consultația inițială. Un client nou vede/poate rezerva singur din
 * portal doar terapii marcate `is_consultation`, până la acest pas. */
export async function updateClientUnlockedTherapies(
  clientProfileId: string,
  _state: UnlockedTherapiesFormState,
  formData: FormData
): Promise<UnlockedTherapiesFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const therapyIds = formData.getAll("therapyIds").map(String);
  try {
    await apiPut(`/clients/${clientProfileId}/unlocked-therapies`, { therapy_ids: therapyIds });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientProfileId}`);
  return { success: true, message: "Terapii actualizate." };
}

export type PatientDetailsFormState = { message?: string; success?: boolean } | undefined;

/** Datele pacientului pe fișa medicală — completate/corectate de personal
 * când pacientul nu le-a introdus singur din portal. */
export async function updateClientDetails(
  clientProfileId: string,
  _state: PatientDetailsFormState,
  formData: FormData
): Promise<PatientDetailsFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const value = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const fullName = value("fullName");
  if (!fullName) return { message: "Numele nu poate fi gol." };
  const cnp = value("cnp");
  if (cnp && !/^\d{13}$/.test(cnp)) return { message: "CNP-ul are exact 13 cifre." };
  try {
    await apiPatch(`/clients/${clientProfileId}/details`, {
      full_name: fullName,
      phone: value("phone"),
      cnp,
      birth_date: value("birthDate"),
      gender: value("gender"),
      city: value("city"),
      county: value("county"),
      address: value("address"),
      occupation: value("occupation"),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientProfileId}`);
  return { success: true, message: "Datele pacientului au fost salvate." };
}

export type MedicalHistoryFormState = { message?: string; success?: boolean } | undefined;
export type ProfileFormState = { message?: string; success?: boolean } | undefined;

/** Chestionarul medical pre-consultație, completat chiar de client. */
export async function updateOwnMedicalHistory(
  _state: MedicalHistoryFormState,
  formData: FormData
): Promise<MedicalHistoryFormState> {
  try {
    await apiPatch("/clients/me/medical-history", {
      allergies: String(formData.get("allergies") ?? "") || null,
      conditions: String(formData.get("conditions") ?? "") || null,
      medications: String(formData.get("medications") ?? "") || null,
      previous_injuries: String(formData.get("previousInjuries") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/portal");
  return { success: true, message: "Chestionar salvat." };
}

const optionalValue = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim() || null;

/** Date de profil neclinice, pentru comunicare și rapoarte agregate. */
export async function updateOwnProfileData(
  _state: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  try {
    await apiPatch("/clients/me/profile", {
      birth_date: optionalValue(formData, "birthDate"),
      gender: optionalValue(formData, "gender"),
      city: optionalValue(formData, "city"),
      county: optionalValue(formData, "county"),
      address: optionalValue(formData, "address"),
      occupation: optionalValue(formData, "occupation"),
      occupation_category: optionalValue(formData, "occupationCategory"),
      preferred_contact: optionalValue(formData, "preferredContact"),
      preferred_language: optionalValue(formData, "preferredLanguage"),
      referral_source: optionalValue(formData, "referralSource"),
      referral_details: optionalValue(formData, "referralDetails"),
      activity_level: optionalValue(formData, "activityLevel"),
      primary_goal: optionalValue(formData, "primaryGoal"),
      secondary_goal: optionalValue(formData, "secondaryGoal"),
      interest: optionalValue(formData, "interest"),
      communication_consent: formData.get("communicationConsent") === "on",
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/portal");
  return { success: true, message: "Profil salvat." };
}

/** GDPR Art. 15 — export complet, imediat, al datelor proprii ale clientului. */
export async function exportOwnData(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>("/clients/me/export");
}

export type DataRequestResult = { ok: true; message: string } | { ok: false; message: string };

/** GDPR Art. 17 — clientul solicită ștergerea/anonimizarea contului. Cererea
 * e revizuită manual de admin (vezi listPendingDataSubjectRequests), nu se
 * execută automat, fiindcă fișele medicale/financiare trebuie păstrate
 * conform obligațiilor legale de arhivare. */
export async function requestOwnDataErasure(): Promise<DataRequestResult> {
  try {
    const result = await apiPost<{ message: string }>("/clients/me/erasure-request");
    return { ok: true, message: result.message };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

export type DataSubjectRequestSummary = {
  id: string;
  client_id: string;
  client_name: string;
  type: "EXPORT" | "ERASURE";
  created_at: string;
};

/** Admin: coada de cereri GDPR nesoluționate (doar ștergerea ajunge aici —
 * exportul e imediat/self-service). */
export async function listPendingDataSubjectRequests(): Promise<DataSubjectRequestSummary[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<DataSubjectRequestSummary[]>("/data-subject-requests");
}

/** Admin: anonimizează contul (păstrează fișele medicale/financiare, cum
 * impune legea, dar le deconectează de la o identitate reperabilă). */
export async function completeDataSubjectRequest(requestId: string) {
  await requireRole(Role.ADMIN);
  await apiPost(`/data-subject-requests/${requestId}/complete`);
  revalidatePath("/admin/setari");
}

export async function rejectDataSubjectRequest(requestId: string, note: string) {
  await requireRole(Role.ADMIN);
  await apiPost(`/data-subject-requests/${requestId}/reject`, { notes: note });
  revalidatePath("/admin/setari");
}

export type ClientDocument = {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by_label: string;
};

/** Admin/recepție: documente atașate fișei clientului (scanări, poze, etc.) — nu vizibile clientului. */
export async function listClientDocuments(clientId: string): Promise<ClientDocument[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ClientDocument[]>(`/clients/${clientId}/documents`);
}

export type UploadDocumentFormState = { message?: string; success?: boolean } | undefined;

export async function uploadClientDocument(
  clientId: string,
  _state: UploadDocumentFormState,
  formData: FormData
): Promise<UploadDocumentFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Alege un fișier de încărcat." };
  }

  const form = new FormData();
  form.set("file", file);

  try {
    await apiPostForm(`/clients/${clientId}/documents`, form);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Document încărcat." };
}

export async function deleteClientDocument(clientId: string, docId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiDelete(`/clients/${clientId}/documents/${docId}`);
  revalidatePath(`/admin/clienti/${clientId}`);
}

/** Statistici rapide pentru bordul admin. */
export async function getDashboardStats() {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<{ active_clients: number; pending: number; active_appointments: number }>("/dashboard/stats");
}
