"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type Coupon = {
  id: string;
  code: string;
  type: string;
  value: string;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  therapies: { id: string; name: string }[];
};

export type CouponFormState = { message?: string } | undefined;

export async function listCoupons(): Promise<Coupon[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<Coupon[]>("/coupons");
}

function couponPayloadFrom(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    type: String(formData.get("type") ?? "PROCENT"),
    value: Number(formData.get("value")),
    valid_from: formData.get("validFrom") || null,
    valid_until: formData.get("validUntil") || null,
    max_uses: formData.get("maxUses") ? Number(formData.get("maxUses")) : null,
    therapy_ids: formData.getAll("therapyIds").map(String).filter(Boolean),
  };
}

export async function createCoupon(
  _state: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await requireRole(Role.ADMIN);

  try {
    await apiPost("/coupons", couponPayloadFrom(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/admin/cupoane");
  return undefined;
}

export async function updateCoupon(
  couponId: string,
  _state: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await requireRole(Role.ADMIN);

  try {
    await apiPut(`/coupons/${couponId}`, couponPayloadFrom(formData));
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/admin/cupoane");
  return undefined;
}

export async function toggleCouponActive(couponId: string, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/coupons/${couponId}/toggle?active=${active}`);
  revalidatePath("/admin/cupoane");
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

/** Ștergere reală — backend-ul refuză (409) dacă cuponul a fost deja
 * folosit; returnăm mesajul lui, nu unul generic. */
export async function deleteCoupon(couponId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/coupons/${couponId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/cupoane");
  return { ok: true };
}
