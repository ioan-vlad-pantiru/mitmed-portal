"use server";

import { redirect } from "next/navigation";
import { apiAuthRequest, ApiError } from "@/lib/apiClient";
import { verifySession } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import type { LoginFormState, RegisterFormState } from "@/lib/definitions";

export async function login(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Completează emailul și parola." };
  }

  let user;
  try {
    user = await apiAuthRequest<{ role: string }>("/auth/login", { email, password });
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

  if (fullName.length < 2 || !email || password.length < 8) {
    return { message: "Completează toate câmpurile obligatorii (parola: minim 8 caractere)." };
  }

  try {
    const result = await apiAuthRequest<{ message: string }>("/auth/register", {
      full_name: fullName,
      email,
      phone: phone || null,
      password,
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
