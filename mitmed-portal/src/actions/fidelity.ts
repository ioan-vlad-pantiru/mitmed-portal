"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type FidelityTier = { session_number: number; discount_percent: string };

export type FidelityCardType = {
  id: string;
  name: string;
  therapy_id: string;
  therapy_name: string;
  active: boolean;
  tiers: FidelityTier[];
};

export type ClientFidelityCard = {
  id: string;
  card_type_id: string;
  card_type_name: string;
  therapy_id: string;
  therapy_name: string;
  tiers: FidelityTier[];
  stamps: number;
  cycle_length: number;
  next_discount_percent: string | null;
  discounted_sessions_used: number;
  active: boolean;
  issued_at: string;
};

export async function listFidelityCardTypes(): Promise<FidelityCardType[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<FidelityCardType[]>("/fidelity-cards/types");
}

export type FidelityCardTypeFormState = { message?: string } | undefined;

/** `tiers` vine ca JSON într-un input ascuns (număr variabil de trepte,
 * editat ca listă în React) — vezi TierEditor.tsx. */
function parseCardTypeForm(formData: FormData) {
  const tiersRaw = String(formData.get("tiersJson") ?? "[]");
  let tiers: { session_number: number; discount_percent: number }[] = [];
  try {
    tiers = JSON.parse(tiersRaw);
  } catch {
    tiers = [];
  }
  return {
    name: String(formData.get("name") ?? ""),
    therapy_id: String(formData.get("therapyId") ?? ""),
    tiers,
  };
}

export async function createFidelityCardType(
  _state: FidelityCardTypeFormState,
  formData: FormData
): Promise<FidelityCardTypeFormState> {
  await requireRole(Role.ADMIN);
  const payload = parseCardTypeForm(formData);
  if (!payload.tiers.length) return { message: "Adaugă cel puțin o treaptă." };
  try {
    await apiPost("/fidelity-cards/types", payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fidelitate");
  return undefined;
}

export async function updateFidelityCardType(
  typeId: string,
  _state: FidelityCardTypeFormState,
  formData: FormData
): Promise<FidelityCardTypeFormState> {
  await requireRole(Role.ADMIN);
  const payload = parseCardTypeForm(formData);
  if (!payload.tiers.length) return { message: "Adaugă cel puțin o treaptă." };
  try {
    await apiPut(`/fidelity-cards/types/${typeId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/fidelitate");
  return undefined;
}

export async function toggleFidelityCardTypeActive(typeId: string, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/fidelity-cards/types/${typeId}/toggle?active=${active}`);
  revalidatePath("/admin/fidelitate");
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

export async function deleteFidelityCardType(typeId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiDelete(`/fidelity-cards/types/${typeId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath("/admin/fidelitate");
  return { ok: true };
}

/** Cardurile emise unui client anume — folosit pe fișa clientului. */
export async function listClientFidelityCards(clientId: string): Promise<ClientFidelityCard[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ClientFidelityCard[]>(`/clients/${clientId}/fidelity-cards`);
}

export type IssueCardFormState = { message?: string; success?: boolean } | undefined;

export async function issueFidelityCard(
  clientId: string,
  _state: IssueCardFormState,
  formData: FormData
): Promise<IssueCardFormState> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const cardTypeId = String(formData.get("cardTypeId") ?? "");
  if (!cardTypeId) return { message: "Alege un tip de card." };
  try {
    await apiPost(`/clients/${clientId}/fidelity-cards`, { card_type_id: cardTypeId });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Card emis." };
}

export async function toggleClientFidelityCard(clientId: string, cardId: string, active: boolean) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  await apiPost(`/clients/${clientId}/fidelity-cards/${cardId}/toggle?active=${active}`);
  revalidatePath(`/admin/clienti/${clientId}`);
}

export async function deleteClientFidelityCard(clientId: string, cardId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  try {
    await apiDelete(`/clients/${clientId}/fidelity-cards/${cardId}`);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { ok: true };
}

/** Propriile carduri active — pentru afișarea în portal. */
export async function listOwnFidelityCards(): Promise<ClientFidelityCard[]> {
  await verifySession();
  return apiGet<ClientFidelityCard[]>("/clients/me/fidelity-cards");
}
