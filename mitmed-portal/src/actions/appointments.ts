"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type AppointmentFormState = { message?: string; success?: string; paymentId?: string | null } | undefined;
export type AppointmentAvailability = { slots: string[] };

/** Orele sunt calculate pe API din agenda live și durata terapiei selectate. */
export async function getOwnAppointmentAvailability(
  day: string,
  therapyId: string
): Promise<AppointmentAvailability> {
  const user = await verifySession();
  if (user.role !== Role.CLIENT) {
    throw new Error("Doar clienții pot vedea disponibilitatea din portal.");
  }
  return apiGet<AppointmentAvailability>("/appointments/availability", { day, therapy_id: therapyId });
}

export async function createOwnAppointment(
  _state: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const user = await verifySession();
  if (user.role !== Role.CLIENT) {
    return { message: "Doar clienții pot face programări din contul lor." };
  }

  let paymentId: string | null = null;
  try {
    const result = await apiPost<{ payment_id: string | null }>("/appointments/me", {
      therapy_id: String(formData.get("therapyId") ?? ""),
      starts_at: String(formData.get("startsAt") ?? ""),
    });
    paymentId = result.payment_id;
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/portal");
  revalidatePath("/portal/programari");
  return { success: "Programarea ta a fost confirmată.", paymentId };
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

export type CancelResult = { ok: true } | { ok: false; message: string };

export async function cancelAppointment(appointmentId: string, clientId: string): Promise<CancelResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost(`/appointments/${appointmentId}/cancel`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Reprogramare (doar admin, fără limita de 48h) — programul cabinetului se
 * verifică pe backend la fel ca la o programare nouă. */
export async function rescheduleAppointment(
  appointmentId: string,
  clientId: string,
  _state: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut(`/appointments/${appointmentId}`, {
      starts_at: String(formData.get("startsAt") ?? ""),
      therapy_id: String(formData.get("therapyId") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin");
  return { success: "Programarea a fost mutată." };
}

/** Șterge definitiv o programare (doar admin, oricând). */
export async function deleteAppointment(appointmentId: string, clientId: string): Promise<CancelResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/appointments/${appointmentId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Clientul își anulează propria programare — aceeași regulă de 48h,
 * verificată și pe backend (sursa de adevăr), nu doar aici. */
export async function cancelOwnAppointment(appointmentId: string): Promise<CancelResult> {
  await verifySession();
  try {
    await apiPost(`/appointments/${appointmentId}/cancel/me`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/portal");
  return { ok: true };
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
  consents: { type: string; signed_at: string }[];
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

export type ClientCancellation = {
  appointment_id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  therapy_name: string;
  starts_at: string;
  cancelled_at: string;
};

/** Programările anulate de clienți din portal în ultimele 7 zile (pentru bord). */
export async function listRecentClientCancellations(): Promise<ClientCancellation[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ClientCancellation[]>("/appointments/cancelled-by-clients", { days: 7 });
}
