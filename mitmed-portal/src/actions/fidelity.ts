"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type FidelityTier = { session_number: number; discount_percent: string };

export type FidelityCardTherapy = { therapy_id: string; therapy_name: string; tiers: FidelityTier[] };

export type FidelityCardType = {
  id: string;
  name: string;
  active: boolean;
  therapies: FidelityCardTherapy[];
};

/** Progresul unui card emis pe UNA dintre terapiile lui — fiecare terapie
 * are propriul contor și propriul program de trepte. */
export type FidelityTherapyProgress = FidelityCardTherapy & {
  stamps: number;
  cycle_length: number;
  next_discount_percent: string | null;
  /** Următoarea treaptă din ciclul curent; sessions_left = 0 înseamnă că
   * chiar următoarea ședință plătită are reducere. */
  next_reward: { session_number: number; discount_percent: string; sessions_left: number } | null;
  discounted_sessions_used: number;
};

export type ClientFidelityCard = {
  id: string;
  card_type_id: string;
  card_type_name: string;
  therapies: FidelityTherapyProgress[];
  active: boolean;
  issued_at: string;
};

export type IssuedFidelityCard = ClientFidelityCard & { client_id: string; client_name: string };

export async function listFidelityCardTypes(): Promise<FidelityCardType[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<FidelityCardType[]>("/fidelity-cards/types");
}

export type FidelityCardTypeFormState = { message?: string } | undefined;

type CardTherapyPayload = { therapy_id: string; tiers: { session_number: number; discount_percent: number }[] };

/** Terapiile cardului, fiecare cu treptele ei, vin ca JSON într-un input
 * ascuns (listă variabilă, editată în React) — vezi CardTypeEditor.tsx. */
function parseCardTypeForm(formData: FormData) {
  let therapies: CardTherapyPayload[] = [];
  try {
    therapies = JSON.parse(String(formData.get("therapiesJson") ?? "[]"));
  } catch {
    therapies = [];
  }
  return { name: String(formData.get("name") ?? ""), therapies };
}

function validateCardTypeForm(payload: ReturnType<typeof parseCardTypeForm>): string | undefined {
  if (!payload.therapies.length) return "Adaugă cel puțin o terapie.";
  if (payload.therapies.some((t) => !t.tiers.length)) return "Fiecare terapie are nevoie de cel puțin o treaptă.";
  if (new Set(payload.therapies.map((t) => t.therapy_id)).size !== payload.therapies.length)
    return "Fiecare terapie poate apărea o singură dată pe card.";
  return undefined;
}

export async function createFidelityCardType(
  _state: FidelityCardTypeFormState,
  formData: FormData
): Promise<FidelityCardTypeFormState> {
  await requireRole(Role.ADMIN);
  const payload = parseCardTypeForm(formData);
  const invalid = validateCardTypeForm(payload);
  if (invalid) return { message: invalid };
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
  const invalid = validateCardTypeForm(payload);
  if (invalid) return { message: invalid };
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

/** Toate cardurile active, cu progresul — vederea de ansamblu din /admin/fidelitate. */
export async function listIssuedFidelityCards(): Promise<IssuedFidelityCard[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<IssuedFidelityCard[]>("/fidelity-cards/issued");
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
  await requireRole(Role.ADMIN);
  const cardTypeId = String(formData.get("cardTypeId") ?? "");
  if (!cardTypeId) return { message: "Alege un tip de card." };
  const therapyIds = formData.getAll("therapyIds").map(String);
  if (!therapyIds.length) return { message: "Bifează cel puțin o terapie pentru acest client." };
  try {
    await apiPost(`/clients/${clientId}/fidelity-cards`, { card_type_id: cardTypeId, therapy_ids: therapyIds });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { success: true, message: "Card emis." };
}

export async function updateClientCardTherapies(clientId: string, cardId: string, therapyIds: string[]): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut(`/clients/${clientId}/fidelity-cards/${cardId}/therapies`, { therapy_ids: therapyIds });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
  revalidatePath(`/admin/clienti/${clientId}`);
  return { ok: true };
}

export async function toggleClientFidelityCard(clientId: string, cardId: string, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/clients/${clientId}/fidelity-cards/${cardId}/toggle?active=${active}`);
  revalidatePath(`/admin/clienti/${clientId}`);
}

export async function deleteClientFidelityCard(clientId: string, cardId: string): Promise<DeleteResult> {
  await requireRole(Role.ADMIN);
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
