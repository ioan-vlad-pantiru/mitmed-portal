"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ClientSummary = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  status: string;
};

export type PendingUser = { id: string; email: string; full_name: string | null };

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

  if (fullName.length < 2 || !email || password.length < 8) {
    return { message: "Completează toate câmpurile obligatorii (parola: minim 8 caractere).", values };
  }

  try {
    await apiPost("/clients", { full_name: fullName, email, phone: phone || null, password });
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

export async function updateClientNotes(clientProfileId: string, notes: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPatch(`/clients/${clientProfileId}/notes`, { notes });
  revalidatePath(`/admin/clienti/${clientProfileId}`);
}

export type MedicalHistoryFormState = { message?: string; success?: boolean } | undefined;

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

/** Statistici rapide pentru bordul admin. */
export async function getDashboardStats() {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<{ active_clients: number; pending: number; active_appointments: number }>("/dashboard/stats");
}
