"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type StaffMember = {
  id: string;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
};

export type StaffFormState = { message?: string; created?: string } | undefined;

export async function listStaff(): Promise<StaffMember[]> {
  await requireRole(Role.ADMIN);
  return apiGet<StaffMember[]>("/staff");
}

export async function createStaff(_state: StaffFormState, formData: FormData): Promise<StaffFormState> {
  await requireRole(Role.ADMIN);

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("passwordConfirm") ?? "")) {
    return { message: "Parolele nu coincid." };
  }

  try {
    await apiPost("/staff", { email, password, role: String(formData.get("role") ?? Role.RECEPTIE) });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/admin/personal");
  return { created: email.trim().toLowerCase() };
}

export async function setStaffActive(
  userId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN);
  try {
    await apiPost(`/staff/${userId}/status`, { active });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/personal");
  return { ok: true };
}
