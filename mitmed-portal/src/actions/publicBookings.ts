"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type BookingRequest = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  therapy_name: string | null;
  preferred_starts_at: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

/** Cererile de programare trimise de pe widget-ul public (site-ul de prezentare). */
export async function listBookingRequests(): Promise<BookingRequest[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<BookingRequest[]>("/public/booking-requests");
}

export async function rejectBookingRequest(requestId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/public/booking-requests/${requestId}/reject`);
  revalidatePath("/admin/cereri");
}

/** Marchează cererea rezolvată — după ce ai creat manual contul + programarea. */
export async function markBookingRequestConfirmed(requestId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/public/booking-requests/${requestId}/mark-confirmed`);
  revalidatePath("/admin/cereri");
}
