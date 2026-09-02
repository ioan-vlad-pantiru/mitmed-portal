"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type MedicalRecordFormState = { message?: string } | undefined;

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
      appointment_id: formData.get("appointmentId") || null,
      diagnosis: formData.get("diagnosis") || null,
      notes,
      treatment_plan: formData.get("treatmentPlan") || null,
      session_date: formData.get("sessionDate") || null,
      body_map: bodyMap,
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
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  try {
    await apiPut(`/medical-records/${recordId}`, {
      diagnosis: formData.get("diagnosis") || null,
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return undefined;
}
