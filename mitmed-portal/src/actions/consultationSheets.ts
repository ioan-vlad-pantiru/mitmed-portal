"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ConsultationSheetFormState = { message?: string; success?: boolean } | undefined;

export type SheetFieldType = "text" | "textarea";

export type SheetTemplateKind = "consultatie" | "tratament" | "custom";

/** Un tip de fișă: fișa de consultație, fișa de tratament sau o fișă construită de admin. */
export type SheetTemplate = {
  id: string;
  name: string;
  kind: SheetTemplateKind;
  description: string | null;
  visible_to_client: boolean;
  position: number;
  archived: boolean;
};

export type ConsultationSheetField = {
  id: string;
  template_id: string;
  label: string;
  field_type: SheetFieldType;
  section: string | null;
  placeholder: string | null;
  carry_over: boolean;
  position: number;
  archived: boolean;
};

export async function listSheetTemplates(): Promise<SheetTemplate[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<SheetTemplate[]>("/consultation-sheets/templates");
}

/** Câmpurile fișelor, în ordinea din formular — ale unui tip (`templateId`) sau
 * ale tuturor tipurilor. Cu `includeArchived`, și cele șterse — necesare ca să
 * afișăm valorile completate pe fișele vechi. */
export async function listConsultationSheetFields(
  includeArchived = false,
  templateId?: string
): Promise<ConsultationSheetField[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ConsultationSheetField[]>("/consultation-sheets/fields", {
    include_archived: includeArchived,
    ...(templateId ? { template_id: templateId } : {}),
  });
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

/** O fișă nouă pentru pacient (consultație sau o fișă construită de admin). */
export async function createConsultationSheet(
  clientId: string,
  templateId: string,
  _state: ConsultationSheetFormState,
  formData: FormData
): Promise<ConsultationSheetFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost("/consultation-sheets", { client_id: clientId, template_id: templateId, ...toPayload(formData) });
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
  // Doar adminul modifică o fișă deja salvată.
  await requireRole(Role.ADMIN);
  try {
    await apiPut(`/consultation-sheets/${sheetId}`, toPayload(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Fișa a fost actualizată." };
}

export async function deleteConsultationSheet(
  sheetId: string,
  clientId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/consultation-sheets/${sheetId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { ok: true };
}

// --- Tipurile de fișe (Setări → Fișe medicale) ---

export type SheetTemplateFormState = { message?: string; success?: boolean; id?: string } | undefined;

function templatePayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    visible_to_client: formData.get("visibleToClient") === "on",
  };
}

export async function createSheetTemplate(
  _state: SheetTemplateFormState,
  formData: FormData
): Promise<SheetTemplateFormState> {
  await requireRole(Role.ADMIN);
  const payload = templatePayload(formData);
  if (!payload.name) return { message: "Completează denumirea fișei." };
  let created: SheetTemplate;
  try {
    created = await apiPost<SheetTemplate>("/consultation-sheets/templates", payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { success: true, message: "Fișă creată. Adaugă-i acum câmpurile.", id: created.id };
}

export async function updateSheetTemplate(
  templateId: string,
  _state: SheetTemplateFormState,
  formData: FormData
): Promise<SheetTemplateFormState> {
  await requireRole(Role.ADMIN);
  const payload = templatePayload(formData);
  if (!payload.name) return { message: "Completează denumirea fișei." };
  try {
    await apiPut(`/consultation-sheets/templates/${templateId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { success: true, message: "Fișă actualizată." };
}

export async function deleteSheetTemplate(templateId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/consultation-sheets/templates/${templateId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/fisa-consultatie");
  return { ok: true };
}

// --- Configurarea câmpurilor (Setări → Fișe medicale) ---

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

export async function createSheetField(
  templateId: string,
  _state: SheetFieldFormState,
  formData: FormData
): Promise<SheetFieldFormState> {
  await requireRole(Role.ADMIN);
  const payload = fieldPayload(formData);
  if (!payload.label) return { message: "Completează denumirea câmpului." };
  try {
    await apiPost("/consultation-sheets/fields", { ...payload, template_id: templateId });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  // Câmpul poate fi adăugat și direct din fișa unui pacient — reîmprospătează
  // și fișele deschise, nu doar setările.
  revalidatePath("/admin/fisa-consultatie");
  revalidatePath("/admin/clienti/[id]", "page");
  revalidatePath("/admin/consult/[appointmentId]", "page");
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
  revalidatePath("/admin/clienti/[id]", "page");
  revalidatePath("/admin/consult/[appointmentId]", "page");
  return { ok: true };
}

export async function moveSheetField(fieldId: string, direction: "up" | "down"): Promise<void> {
  await requireRole(Role.ADMIN);
  await apiPost(`/consultation-sheets/fields/${fieldId}/move`, { direction });
  revalidatePath("/admin/fisa-consultatie");
}
