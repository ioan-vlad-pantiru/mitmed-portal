"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type Therapy = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: string;
  active: boolean;
  is_consultation: boolean;
};

export type TherapyFormState = { message?: string } | undefined;

export async function listTherapies(): Promise<Therapy[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE, Role.CLIENT);
  return apiGet<Therapy[]>("/therapies");
}

function parseTherapyForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    duration_minutes: Number(formData.get("durationMinutes")),
    price: Number(formData.get("price")),
    is_consultation: formData.get("isConsultation") === "on",
  };
}

export async function createTherapy(
  _state: TherapyFormState,
  formData: FormData
): Promise<TherapyFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPost("/therapies", parseTherapyForm(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/terapii");
  return undefined;
}

export async function updateTherapy(
  therapyId: string,
  _state: TherapyFormState,
  formData: FormData
): Promise<TherapyFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut(`/therapies/${therapyId}`, parseTherapyForm(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/terapii");
  return undefined;
}

export async function toggleTherapyActive(therapyId: string, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/therapies/${therapyId}/toggle?active=${active}`);
  revalidatePath("/admin/terapii");
}

/** `archived` = terapia avea istoric, deci a fost scoasă din catalog, nu ștearsă de tot. */
export type DeleteResult = { ok: true; archived: boolean } | { ok: false; message: string };

/** Șterge terapia — backend-ul o arhivează (în loc s-o șteargă de tot) dacă
 * are deja istoric; refuză doar cât are programări viitoare sau e într-un
 * pachet în vânzare, iar atunci returnăm mesajul lui, nu unul generic. */
export async function deleteTherapy(therapyId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
  try {
    const result = await apiDelete<{ archived?: boolean }>(`/therapies/${therapyId}`);
    revalidatePath("/admin/terapii");
    return { ok: true, archived: Boolean(result?.archived) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}
