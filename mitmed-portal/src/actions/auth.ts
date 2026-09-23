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
    const result = await apiAuthRequest<{ message: string }>("/auth/register", {
      full_name: fullName,
      email: email || null,
      phone,
      password,
      birth_date: birthDate,
      accepted_privacy_policy: acceptedPrivacyPolicy,
    });
    return { success: true, message: result.message };
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
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
