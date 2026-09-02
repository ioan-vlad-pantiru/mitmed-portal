"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

// Tipul de document nu mai e un enum fix — ADMIN poate adăuga oricând unul
// nou din /admin/documente, deci rămâne un identificator liber (string).
export type ConsentType = string;

export type Consent = { id: string; type: ConsentType; version_text: string; signed_at: string };

export type ConsentTemplate = {
  type: ConsentType;
  label: string;
  text: string;
  active: boolean;
  updated_at: string;
};

export async function getCurrentConsentText(type: ConsentType): Promise<string> {
  await verifySession();
  const result = await apiGet<{ text: string }>("/consents/current-text", { type });
  return result.text;
}

export async function getOwnConsents(): Promise<Consent[]> {
  await verifySession();
  return apiGet<Consent[]>("/consents/me");
}

export async function getClientConsents(clientId: string) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<(Consent & { signature_data_url: string })[]>(`/consents/${clientId}`);
}

/** Toate tipurile de document, inclusiv cele dezactivate — pentru
 * /admin/documente, unde admin le gestionează pe toate. */
export async function listConsentTemplates(): Promise<ConsentTemplate[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ConsentTemplate[]>("/consents/templates");
}

/** Doar tipurile active — ce trebuie semnat de client / afișat ca badge în
 * portal și ecranul de Consult. */
export async function listActiveConsentTemplates(): Promise<ConsentTemplate[]> {
  await verifySession();
  return apiGet<ConsentTemplate[]>("/consents/templates/active");
}

export type ConsentTemplateFormState = { message?: string; success?: boolean } | undefined;

/** ADMIN adaugă un tip nou de document de semnat — devine vizibil imediat
 * în portal, fără nicio schimbare de cod. */
export async function createConsentTemplate(
  _state: ConsentTemplateFormState,
  formData: FormData
): Promise<ConsentTemplateFormState> {
  await requireRole(Role.ADMIN);
  const label = String(formData.get("label") ?? "");
  const text = String(formData.get("text") ?? "");
  if (!label.trim()) return { message: "Numele documentului nu poate fi gol." };
  if (!text.trim()) return { message: "Textul nu poate fi gol." };

  try {
    await apiPost("/consents/templates", { label, text });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/documente");
  return { success: true, message: "Document nou adăugat." };
}

export type UpdateTemplateState = { message?: string; success?: boolean } | undefined;

export async function updateConsentTemplate(
  type: ConsentType,
  _state: UpdateTemplateState,
  formData: FormData
): Promise<UpdateTemplateState> {
  await requireRole(Role.ADMIN);
  const label = String(formData.get("label") ?? "");
  const text = String(formData.get("text") ?? "");
  if (!label.trim()) return { message: "Numele documentului nu poate fi gol." };
  if (!text.trim()) return { message: "Textul nu poate fi gol." };

  try {
    await apiPut(`/consents/templates/${type}`, { label, text });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/documente");
  return { success: true, message: "Document actualizat." };
}

export async function toggleConsentTemplateActive(type: ConsentType, active: boolean) {
  await requireRole(Role.ADMIN);
  await apiPost(`/consents/templates/${type}/toggle?active=${active}`);
  revalidatePath("/admin/documente");
}

export type SignConsentState = { message?: string; success?: boolean } | undefined;

export async function signConsent(
  type: ConsentType,
  _state: SignConsentState,
  formData: FormData
): Promise<SignConsentState> {
  await verifySession();
  const signatureDataUrl = String(formData.get("signature") ?? "");
  if (!signatureDataUrl) {
    return { message: "Semnează în chenar înainte de a trimite." };
  }
  try {
    await apiPost("/consents/me", { type, signature_data_url: signatureDataUrl });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/portal");
  return { success: true, message: "Declarație semnată." };
}
