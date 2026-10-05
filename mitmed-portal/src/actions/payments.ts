"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiGetText, apiPost, ApiError } from "@/lib/apiClient";
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

async function deleteAndRevalidate(path: string, clientId: string): Promise<MarkPaidResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(path);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  revalidatePath("/admin/insights");
  return { ok: true };
}

/** Șterge definitiv o plată introdusă greșit — doar ADMIN. Refuzat de backend
 * pentru plăți confirmate prin PayU și pentru linii de pachet. */
export async function deletePayment(paymentId: string, clientId: string): Promise<MarkPaidResult> {
  return deleteAndRevalidate(`/payments/${paymentId}`, clientId);
}

/** Șterge definitiv o achiziție de pachet întreagă — doar ADMIN. */
export async function deletePackagePurchase(packagePurchaseId: string, clientId: string): Promise<MarkPaidResult> {
  return deleteAndRevalidate(`/payments/package/${packagePurchaseId}`, clientId);
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

export type PaymentLineInput = { therapyId: string; appointmentId?: string | null };

export type MultiPaymentInput = {
  clientId: string;
  lines: PaymentLineInput[];
  couponCode?: string;
  method?: string | null;
  amountPaid?: number | null;
};

export type PricedPaymentLine = {
  therapy_id: string;
  therapy_name: string;
  appointment_id: string | null;
  appointment_starts_at: string | null;
  base_price: string;
  discount_amount: string;
  final_price: string;
  coupon_code: string | null;
  fidelity_card_name: string | null;
  fidelity_discount_percent: string | null;
};

export type MultiPaymentPreview = {
  lines: PricedPaymentLine[];
  base_price: string;
  discount_amount: string;
  final_price: string;
};

function multiPaymentPayload(input: MultiPaymentInput) {
  return {
    client_id: input.clientId,
    lines: input.lines.map((l) => ({ therapy_id: l.therapyId, appointment_id: l.appointmentId || null })),
    coupon_code: input.couponCode || null,
    method: input.method || null,
    amount_paid: input.amountPaid ?? null,
  };
}

/** Prețul fiecărei linii + totalul, cu fidelitatea calculată în ordinea
 * liniilor (vezi routers/payments.py:_price_lines) — nu salvează nimic. */
export async function previewMultiPayment(
  input: MultiPaymentInput
): Promise<{ ok: true; preview: MultiPaymentPreview } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    return { ok: true, preview: await apiPost<MultiPaymentPreview>("/payments/multi/preview", multiPaymentPayload(input)) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

/** O plată pentru mai multe terapii/programări odată — câte un Payment per linie. */
export async function createMultiPayment(input: MultiPaymentInput): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiPost("/payments/multi", multiPaymentPayload(input));
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${input.clientId}`);
  return { ok: true };
}
