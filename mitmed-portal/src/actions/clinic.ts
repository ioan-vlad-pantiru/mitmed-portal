"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type WeekdayHours = {
  weekday: number; // 0 = luni … 6 = duminică, ca date.weekday() în Python
  is_open: boolean;
  opens_at: string | null; // "HH:MM:SS"
  closes_at: string | null;
  break_starts_at: string | null;
  break_ends_at: string | null;
};

export type Vacation = {
  id: string;
  starts_on: string; // "YYYY-MM-DD"
  ends_on: string;
  label: string | null;
};

/** Programul cabinetului, o intrare per zi a săptămânii — citit de admin,
 * recepție (ca să programeze manual corect) și client (ca portalul să
 * calculeze orele disponibile). */
export async function listWeekdayHours(): Promise<WeekdayHours[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE, Role.CLIENT);
  return apiGet<WeekdayHours[]>("/clinic/hours");
}

export type HoursSaveResult = { ok: true } | { ok: false; message: string };

/** Înlocuiește programul întregii săptămâni dintr-o dată — vine mereu
 * complet (7 zile), nu parțial. Editorul e stare controlată în React (ora +
 * pauza fiecărei zile), nu un <form action>, de-aci semnătura simplă. */
export async function updateWeekdayHours(days: WeekdayHours[]): Promise<HoursSaveResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut("/clinic/hours", { days });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/program");
  return { ok: true };
}

export async function listVacations(): Promise<Vacation[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE, Role.CLIENT);
  return apiGet<Vacation[]>("/clinic/vacations");
}

export type VacationFormState = { message?: string } | undefined;

export async function createVacation(_state: VacationFormState, formData: FormData): Promise<VacationFormState> {
  await requireRole(Role.ADMIN);
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!startsOn || !endsOn) return { message: "Alege ambele date." };

  try {
    await apiPost("/clinic/vacations", { starts_on: startsOn, ends_on: endsOn, label });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/program");
  return undefined;
}

export async function deleteVacation(vacationId: string) {
  await requireRole(Role.ADMIN);
  await apiDelete(`/clinic/vacations/${vacationId}`);
  revalidatePath("/admin/program");
}
