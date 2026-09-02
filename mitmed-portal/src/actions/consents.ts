"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type ConsentType = "GDPR" | "RISC_PRET";

export type Consent = { id: string; type: ConsentType; version_text: string; signed_at: string };

export type ConsentTemplate = { type: ConsentType; text: string; updated_at: string };

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

export async function listConsentTemplates(): Promise<ConsentTemplate[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ConsentTemplate[]>("/consents/templates");
}

export type UpdateTemplateState = { message?: string; success?: boolean } | undefined;

export async function updateConsentTemplate(
  type: ConsentType,
  _state: UpdateTemplateState,
  formData: FormData
): Promise<UpdateTemplateState> {
  await requireRole(Role.ADMIN);
  const text = String(formData.get("text") ?? "");
  if (!text.trim()) return { message: "Textul nu poate fi gol." };

  try {
    await apiPut(`/consents/templates/${type}`, { text });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/documente");
  return { success: true, message: "Text actualizat." };
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
