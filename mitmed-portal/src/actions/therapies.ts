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

export type DeleteResult = { ok: true } | { ok: false; message: string };

/** Ștergere reală — backend-ul refuză (409) dacă terapia a fost deja
 * folosită; returnăm mesajul lui, nu unul generic, ca admin să știe să
 * dezactiveze în loc să șteargă. */
export async function deleteTherapy(therapyId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/therapies/${therapyId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/terapii");
  return { ok: true };
}
