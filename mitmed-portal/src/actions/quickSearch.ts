"use server";

import { apiGet } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import type { CalendarAppointmentApi } from "@/actions/appointments";
import type { ClientSummary } from "@/actions/clients";

export type QuickSearchData = {
  clients: ClientSummary[];
  // client_id -> id-ul programării lui de azi, neefectuate încă (dacă are una) —
  // permite command palette-ului acțiunea directă "Intră în consult cu X".
  todayAppointmentByClient: Record<string, string>;
};

/** Date pentru command palette-ul global (Cmd/Ctrl+K) — încărcate o dată în
 * layout-ul admin, nu per pagină. */
export async function getQuickSearchData(): Promise<QuickSearchData> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [clients, appointments] = await Promise.all([
    apiGet<ClientSummary[]>("/clients"),
    apiGet<CalendarAppointmentApi[]>("/appointments", { start: start.toISOString(), end: end.toISOString() }),
  ]);

  const todayAppointmentByClient: Record<string, string> = {};
  for (const a of appointments) {
    if (a.status === "PROGRAMATA" || a.status === "CONFIRMATA") {
      todayAppointmentByClient[a.client_id] = a.id;
    }
  }

  return { clients, todayAppointmentByClient };
}
