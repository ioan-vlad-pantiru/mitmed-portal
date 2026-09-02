"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiGetText, apiPost, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type PaymentFormState = { message?: string } | undefined;

export async function createPayment(
  _state: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);

  const clientId = String(formData.get("clientId") ?? "");
  const therapyId = String(formData.get("therapyId") ?? "");
  const couponCode = String(formData.get("couponCode") ?? "") || null;
  const method = String(formData.get("method") ?? "") || null;
  const markPaid = Boolean(formData.get("markPaid"));

  try {
    await apiPost("/payments", {
      client_id: clientId,
      therapy_id: therapyId,
      coupon_code: couponCode,
      method,
      mark_paid: markPaid,
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return undefined;
}

export async function markPaymentPaid(paymentId: string, clientId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/payments/${paymentId}/mark-paid`);
  revalidatePath(`/admin/clienti/${clientId}`);
}

/** Export CSV al plăților, pentru contabilitate. */
export async function exportPaymentsCsv(): Promise<string> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGetText("/payments/export");
}

/** Preview live pentru UI — calculează prețul fără să salveze nimic. */
export async function previewPrice(therapyId: string, couponCode: string | undefined) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<{ base_price?: string; discount_amount?: string; final_price?: string; error?: string }>(
    "/payments/preview",
    { therapy_id: therapyId, coupon_code: couponCode }
  );
}
