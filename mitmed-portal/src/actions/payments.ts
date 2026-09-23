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
  const mode = String(formData.get("saleMode") ?? "therapy");
  const method = String(formData.get("method") ?? "") || null;
  const amountPaidRaw = String(formData.get("amountPaid") ?? "").trim();
  const amountPaid = amountPaidRaw ? Number(amountPaidRaw) : null;

  const payload =
    mode === "package"
      ? {
          client_id: clientId,
          package_id: String(formData.get("packageId") ?? ""),
          method,
          amount_paid: amountPaid,
        }
      : {
          client_id: clientId,
          therapy_id: String(formData.get("therapyId") ?? ""),
          coupon_code: String(formData.get("couponCode") ?? "") || null,
          method,
          amount_paid: amountPaid,
        };

  try {
    await apiPost("/payments", payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath(`/admin/clienti/${clientId}`);
  return undefined;
}

export type MarkPaidResult = { ok: true } | { ok: false; message: string };

/** Fie o sumă unică (comportamentul clasic), fie o împărțire explicită
 * numerar/card — cele două forme sunt exclusive, vezi routers/payments.py. */
export type MarkPaidInput = { amount: number } | { cashAmount: number; cardAmount: number };

function markPaidPayload(input?: MarkPaidInput) {
  if (!input) return {};
  if ("amount" in input) return { amount: input.amount };
  return { cash_amount: input.cashAmount, card_amount: input.cardAmount };
}

/** Înregistrează o încasare pentru o plată existentă — fără `input`,
 * încasează tot restul (achitare integrală); cu o sumă unică, doar atât
 * (încasare parțială); cu cashAmount/cardAmount, încasarea se împarte între
 * cele două metode (ex. o parte numerar, o parte card la recepție). */
export async function markPaymentPaid(
  paymentId: string,
  clientId: string,
  input?: MarkPaidInput
): Promise<MarkPaidResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost(`/payments/${paymentId}/mark-paid`, markPaidPayload(input));
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin/insights");
  return { ok: true };
}

/** La fel ca markPaymentPaid, dar pentru o achiziție de pachet întreagă —
 * suma se împarte proporțional pe restul fiecărei terapii incluse, nu se
 * încasează linie cu linie. */
export async function markPackagePaid(
  packagePurchaseId: string,
  clientId: string,
  input?: MarkPaidInput
): Promise<MarkPaidResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost(`/payments/package/${packagePurchaseId}/mark-paid`, markPaidPayload(input));
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin/insights");
  return { ok: true };
}

/** Corectează o greșeală de încasare — spre deosebire de markPaymentPaid,
 * care ADAUGĂ, asta ÎNLOCUIEȘTE suma încasată cu `amount` (0 = anulează
 * complet încasarea). Refuzat de backend pentru o plată confirmată prin
 * PayU — acolo banii chiar au circulat. */
export async function correctAmountPaid(paymentId: string, clientId: string, amount: number): Promise<MarkPaidResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost(`/payments/${paymentId}/correct-amount-paid`, { amount_paid: amount });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin/insights");
  return { ok: true };
}

/** Ca mai sus, pentru o achiziție de pachet întreagă. */
export async function correctPackageAmountPaid(
  packagePurchaseId: string,
  clientId: string,
  amount: number
): Promise<MarkPaidResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost(`/payments/package/${packagePurchaseId}/correct-amount-paid`, { amount_paid: amount });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin/insights");
  return { ok: true };
}

export type PayuCheckoutResult = { redirectUrl: string } | { message: string };

/** Inițiază o comandă PayU pentru o plată neîncasată — folosit atât din
 * portalul clientului (plată pe cont propriu), cât și din admin. Întoarce
 * URL-ul paginii PayU către care browserul trebuie redirecționat. */
export async function createPayuCheckout(paymentId: string): Promise<PayuCheckoutResult> {
  await requireRole(Role.CLIENT, Role.ADMIN, Role.RECEPTIE);
  try {
    const result = await apiPost<{ redirect_url: string }>(`/payments/${paymentId}/payu-checkout`);
    return { redirectUrl: result.redirect_url };
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
}

/** Export CSV al plăților, pentru contabilitate. */
export async function exportPaymentsCsv(): Promise<string> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGetText("/payments/export");
}

/** Preview live pentru UI — calculează prețul fără să salveze nimic. Cu
 * `clientId`, backend-ul verifică și dacă se aplică automat o reducere de
 * fidelitate (vezi routers/payments.py:preview_price). */
export async function previewPrice(therapyId: string, couponCode: string | undefined, clientId?: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<{
    base_price?: string;
    discount_amount?: string;
    final_price?: string;
    fidelity_card_name?: string;
    fidelity_discount_percent?: string;
    error?: string;
  }>("/payments/preview", { therapy_id: therapyId, coupon_code: couponCode, client_id: clientId });
}
