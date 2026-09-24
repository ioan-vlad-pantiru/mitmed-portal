"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ConsultationSheetFormState = { message?: string; success?: boolean } | undefined;

const FIELDS: [string, string][] = [
  ["sheetNumber", "sheet_number"],
  ["maritalStatus", "marital_status"],
  ["antecedents", "antecedents"],
  ["workingConditions", "working_conditions"],
  ["bloodPressure", "blood_pressure"],
  ["pulse", "pulse"],
  ["oxygenSaturation", "oxygen_saturation"],
  ["glycemia", "glycemia"],
  ["symptoms", "symptoms"],
  ["diagnosis", "diagnosis"],
  ["recommendations", "recommendations"],
];

function toPayload(formData: FormData) {
  const payload: Record<string, string | null> = {};
  for (const [formName, apiName] of FIELDS) {
    payload[apiName] = String(formData.get(formName) ?? "").trim() || null;
  }
  const date = String(formData.get("sheetDate") ?? "").trim();
  payload.sheet_date = date ? new Date(`${date}T12:00:00`).toISOString() : null;
  return payload;
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
