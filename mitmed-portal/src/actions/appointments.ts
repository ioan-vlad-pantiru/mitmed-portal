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

export type ConsultData = {
  appointment: { id: string; starts_at: string; status: string; therapy: { id: string; name: string } };
  client: {
    id: string;
    full_name: string;
    birth_date: string | null;
    phone: string | null;
    medical_history: {
      allergies?: string;
      conditions?: string;
      medications?: string;
      previous_injuries?: string;
      notes?: string;
    } | null;
  };
  recent_records: {
    id: string;
    session_date: string;
    diagnosis: string | null;
    notes: string;
    treatment_plan: string | null;
    therapy_name: string | null;
  }[];
  consents: { type: "GDPR" | "RISC_PRET"; signed_at: string }[];
  active_package: { payment_id: string; sessions_used: number; package_total_sessions: number } | null;
};

/** Tot ce trebuie ecranului de Consult, într-un singur apel — vezi
 * GET /appointments/{id}/consult pe backend. */
export async function getAppointmentForConsult(appointmentId: string): Promise<ConsultData | null> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    return await apiGet<ConsultData>(`/appointments/${appointmentId}/consult`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
