"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type MedicalRecordFormState = { message?: string; success?: boolean } | undefined;

/** Terapiile bifate în ședință (pot fi mai multe); undefined = câmpul lipsește din formular. */
function therapyIds(formData: FormData): string[] | undefined {
  if (!formData.has("therapyIdsField")) return undefined;
  return formData.getAll("therapyIds").map(String).filter(Boolean);
}

/** Căsuțele fișei de tratament configurate de admin vin ca `field:<id>`. */
function fieldValues(formData: FormData): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("field:")) values[name.slice(6)] = String(value).trim() || null;
  }
  return values;
}

export async function createMedicalRecord(
  _state: MedicalRecordFormState,
  formData: FormData
): Promise<MedicalRecordFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  const clientId = String(formData.get("clientId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!notes.trim()) return { message: "Notele nu pot fi goale." };

  const bodyMapRaw = String(formData.get("bodyMap") ?? "");
  let bodyMap: unknown = undefined;
  try {
    const parsed = bodyMapRaw ? JSON.parse(bodyMapRaw) : [];
    bodyMap = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    bodyMap = undefined;
  }

  try {
    await apiPost("/medical-records", {
      client_id: clientId,
      therapy_id: formData.get("therapyId") || null,
      therapy_ids: therapyIds(formData),
      appointment_id: formData.get("appointmentId") || null,
      diagnosis: formData.get("diagnosis") || null,
      subjective: formData.get("subjective") || null,
      objective: formData.get("objective") || null,
      assessment: formData.get("assessment") || null,
      notes,
      treatment_plan: formData.get("treatmentPlan") || null,
      session_date: formData.get("sessionDate") || null,
      body_map: bodyMap,
      field_values: fieldValues(formData),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);

  // Ecranul de Consult trimite un câmp ascuns "fromConsult" — la succes,
  // fluxul e "următorul pacient": redirect spre bord (nu spre fișa clientului),
  // cu un toast citit din query string (vezi ConsultSavedToast).
  if (formData.get("fromConsult")) {
    redirect("/admin?consultSaved=1");
  }
  return undefined;
}

export async function updateMedicalRecord(
  recordId: string,
  clientId: string,
  _state: MedicalRecordFormState,
  formData: FormData
): Promise<MedicalRecordFormState> {
  // Doar adminul corectează o ședință deja documentată.
  await requireRole(Role.ADMIN);

  const notes = String(formData.get("notes") ?? "");
  if (!notes.trim()) return { message: "Notele nu pot fi goale." };

  try {
    await apiPut(`/medical-records/${recordId}`, {
      therapy_ids: therapyIds(formData),
      diagnosis: formData.get("diagnosis") || null,
      subjective: formData.get("subjective") || null,
      objective: formData.get("objective") || null,
      assessment: formData.get("assessment") || null,
      notes,
      treatment_plan: formData.get("treatmentPlan") || null,
      field_values: fieldValues(formData),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true };
}
