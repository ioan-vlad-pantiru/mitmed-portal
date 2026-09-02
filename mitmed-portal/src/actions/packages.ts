"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type PackageItem = { therapy_id: string; therapy_name: string; sessions_included: number };

export type TherapyPackage = {
  id: string;
  name: string;
  price: string;
  active: boolean;
  items: PackageItem[];
};

export async function listPackages(): Promise<TherapyPackage[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<TherapyPackage[]>("/packages");
}

export type PackageFormState = { message?: string } | undefined;

function packagePayloadFrom(formData: FormData) {
  const therapyIds = formData.getAll("itemTherapyId").map(String);
  const sessions = formData.getAll("itemSessions").map((v) => Number(v));
  const items = therapyIds
    .map((therapy_id, i) => ({ therapy_id, sessions_included: sessions[i] }))
    .filter((i) => i.therapy_id && i.sessions_included > 0);

  return {
    name: String(formData.get("name") ?? ""),
    price: Number(formData.get("price")),
    items,
  };
}

export async function createPackage(
  _state: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  await requireRole(Role.ADMIN);

  const payload = packagePayloadFrom(formData);
  if (payload.items.length === 0) return { message: "Adaugă cel puțin o terapie în pachet." };

  try {
    await apiPost("/packages", payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/admin/pachete");
  return undefined;
}

export async function updatePackage(
  packageId: string,
  _state: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  await requireRole(Role.ADMIN);

  const payload = packagePayloadFrom(formData);
  if (payload.items.length === 0) return { message: "Adaugă cel puțin o terapie în pachet." };

  try {
    await apiPut(`/packages/${packageId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  revalidatePath("/admin/pachete");
  return undefined;
}

export async function togglePackageActive(packageId: string, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/packages/${packageId}/toggle?active=${active}`);
  revalidatePath("/admin/pachete");
}
