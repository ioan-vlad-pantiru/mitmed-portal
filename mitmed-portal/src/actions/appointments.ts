"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type AppointmentFormState = { message?: string } | undefined;

export async function createOwnAppointment(
  _state: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const user = await verifySession();
  if (user.role !== Role.CLIENT) {
    return { message: "Doar clienții pot face programări din contul lor." };
  }

  try {
    await apiPost("/appointments/me", {
      therapy_id: String(formData.get("therapyId") ?? ""),
      starts_at: String(formData.get("startsAt") ?? ""),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/portal");
  return undefined;
}

export async function createAppointmentForClient(
  clientId: string,
  _state: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  try {
    await apiPost("/appointments/staff", {
      client_id: clientId,
      therapy_id: String(formData.get("therapyId") ?? ""),
      starts_at: String(formData.get("startsAt") ?? ""),
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return undefined;
}

export async function cancelAppointment(appointmentId: string, clientId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/appointments/${appointmentId}/cancel`);
  revalidatePath(`/admin/clienti/${clientId}`);
}

export type CalendarAppointmentApi = {
  id: string;
  client_id: string;
  client_name: string;
  therapy_id: string;
  therapy_name: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

/** Toate programările dintr-un interval (folosit de bordul/calendarul admin). */
export async function listAppointmentsInRange(start: Date, end: Date): Promise<CalendarAppointmentApi[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<CalendarAppointmentApi[]>("/appointments", {
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
