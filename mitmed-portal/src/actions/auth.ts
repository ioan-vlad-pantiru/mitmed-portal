"use server";

import { redirect } from "next/navigation";
import { apiAuthRequest, apiPost, ApiError } from "@/lib/apiClient";
import { verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import type { ChangePasswordFormState, LoginFormState, RegisterFormState } from "@/lib/definitions";

export async function login(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { message: "Completează emailul sau telefonul și parola." };
  }

  let user;
  try {
    user = await apiAuthRequest<{ role: string }>("/auth/login", { identifier, password });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  redirect(user.role === Role.CLIENT ? "/portal" : "/admin");
}

/** Pasul 1 — trimite datele de cont, primește un cod pe WhatsApp. Nu creează
 * încă niciun cont (vezi /auth/register/verify mai jos, care îl creează deja
 * ACTIV — telefonul verificat înlocuiește aprobarea manuală de recepție). */
export async function registerClient(
  _state: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const birthDate = String(formData.get("birthDate") ?? "");
  const acceptedPrivacyPolicy = formData.get("acceptedPrivacyPolicy") === "on";

  if (fullName.length < 2 || !phone || password.length < 8 || !birthDate) {
    return { message: "Completează toate câmpurile obligatorii (telefonul, parola: minim 8 caractere)." };
  }
  if (!acceptedPrivacyPolicy) {
    return { message: "Trebuie să confirmi că ai citit Politica de confidențialitate." };
  }

  try {
    const result = await apiPost<{ message: string; phone: string }>("/auth/register", {
      full_name: fullName,
      email: email || null,
      phone,
      password,
      birth_date: birthDate,
      accepted_privacy_policy: acceptedPrivacyPolicy,
    });
    return { success: true, message: result.message, phone: result.phone };
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
}

export type VerifyCodeResult = { ok: true } | { ok: false; message: string };

/** Pasul 2 — confirmă codul primit pe WhatsApp. La succes, backend-ul creează
 * contul (deja ACTIV) și pornește sesiunea (Set-Cookie) — folosim
 * apiAuthRequest, nu apiPost, exact ca la login, ca acel cookie să ajungă la
 * browser prin Next, nu doar la fetch-ul de pe server. */
export async function verifyRegistrationCode(phone: string, code: string): Promise<VerifyCodeResult> {
  try {
    await apiAuthRequest("/auth/register/verify", { phone, code });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

export type ResendCodeResult = { ok: true } | { ok: false; message: string };

export async function resendRegistrationCode(phone: string): Promise<ResendCodeResult> {
  try {
    await apiPost("/auth/register/resend", { phone });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function logout() {
  await apiAuthRequest("/auth/logout");
  redirect("/login");
}

/** Used by /admin and /portal pages to fetch the current signed-in user. */
export async function getSessionUser() {
  return verifySession();
}

export async function changePassword(
  _state: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || newPassword.length < 8) {
    return { message: "Parola nouă trebuie să aibă minim 8 caractere." };
  }
  if (newPassword !== confirmPassword) {
    return { message: "Parolele noi nu coincid." };
  }

  try {
    await apiPost("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }

  return { success: true, message: "Parola a fost schimbată." };
}
