"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ConsultationSheetFormState = { message?: string; success?: boolean } | undefined;

export type SheetFieldType = "text" | "textarea";

export type ConsultationSheetField = {
  id: string;
  label: string;
  field_type: SheetFieldType;
  section: string | null;
  placeholder: string | null;
  carry_over: boolean;
  position: number;
  archived: boolean;
};

/** Câmpurile fișei, în ordinea din formular. Cu `includeArchived`, și cele
 * șterse — necesare ca să afișăm valorile completate pe fișele vechi. */
export async function listConsultationSheetFields(includeArchived = false): Promise<ConsultationSheetField[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ConsultationSheetField[]>("/consultation-sheets/fields", { include_archived: includeArchived });
}

/** Valorile câmpurilor vin ca `field:<id>` în formular. */
function toPayload(formData: FormData) {
  const values: Record<string, string | null> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("field:")) values[name.slice(6)] = String(value).trim() || null;
  }
  const date = String(formData.get("sheetDate") ?? "").trim();
  return {
    sheet_date: date ? new Date(`${date}T12:00:00`).toISOString() : null,
    sheet_number: String(formData.get("sheetNumber") ?? "").trim() || null,
    values,
  };
}

/** Fișa de consultații și evaluări medicale — creare (prima vizită / reconsult). */
export async function createConsultationSheet(
  clientId: string,
  _state: ConsultationSheetFormState,
  formData: FormData
): Promise<ConsultationSheetFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost("/consultation-sheets", { client_id: clientId, ...toPayload(formData) });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Fișa a fost salvată." };
}

export async function updateConsultationSheet(
  sheetId: string,
  clientId: string,
  _state: ConsultationSheetFormState,
  formData: FormData
): Promise<ConsultationSheetFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPut(`/consultation-sheets/${sheetId}`, toPayload(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Fișa a fost actualizată." };
}

// --- Configurarea câmpurilor (Setări → Fișa de consultație) ---

export type SheetFieldFormState = { message?: string; success?: boolean } | undefined;

function fieldPayload(formData: FormData) {
  return {
    label: String(formData.get("label") ?? "").trim(),
    field_type: formData.get("fieldType") === "text" ? "text" : "textarea",
    section: String(formData.get("section") ?? "").trim() || null,
    placeholder: String(formData.get("placeholder") ?? "").trim() || null,
    carry_over: formData.get("carryOver") === "on",
  };
}

export async function createSheetField(_state: SheetFieldFormState, formData: FormData): Promise<SheetFieldFormState> {
  await requireRole(Role.ADMIN);
  const payload = fieldPayload(formData);
  if (!payload.label) return { message: "Completează denumirea câmpului." };
  try {
    await apiPost("/consultation-sheets/fields", payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { success: true, message: "Câmp adăugat." };
}

export async function updateSheetField(
  fieldId: string,
  _state: SheetFieldFormState,
  formData: FormData
): Promise<SheetFieldFormState> {
  await requireRole(Role.ADMIN);
  const payload = fieldPayload(formData);
  if (!payload.label) return { message: "Completează denumirea câmpului." };
  try {
    await apiPut(`/consultation-sheets/fields/${fieldId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { success: true, message: "Câmp actualizat." };
}

export async function deleteSheetField(fieldId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/consultation-sheets/fields/${fieldId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { ok: true };
}

export async function moveSheetField(fieldId: string, direction: "up" | "down"): Promise<void> {
  await requireRole(Role.ADMIN);
  await apiPost(`/consultation-sheets/fields/${fieldId}/move`, { direction });
  revalidatePath("/admin/fisa-consultatie");
}
