"use server";

import { apiGet, apiPost, ApiError } from "@/lib/apiClient";
import { requireRole, verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type Consent = { id: string; version_text: string; signed_at: string };

export async function getCurrentConsentText(): Promise<string> {
  const result = await apiGet<{ text: string }>("/consents/current-text");
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

export type SignConsentState = { message?: string; success?: boolean } | undefined;

export async function signConsent(
  _state: SignConsentState,
  formData: FormData
): Promise<SignConsentState> {
  await verifySession();
  const signatureDataUrl = String(formData.get("signature") ?? "");
  if (!signatureDataUrl) {
    return { message: "Semnează în chenar înainte de a trimite." };
  }
  try {
    await apiPost("/consents/me", { signature_data_url: signatureDataUrl });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  return { success: true, message: "Acord semnat." };
}
