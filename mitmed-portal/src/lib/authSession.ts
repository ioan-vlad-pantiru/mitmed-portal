import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/apiClient";
import type { Role } from "@/lib/enums";

const SESSION_COOKIE_NAME = "mitmed_session";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  status: string;
  full_name: string | null;
  client_profile_id: string | null;
};

/** Verificare optimistă pentru proxy.ts — doar prezența cookie-ului, fără
 * apel de rețea. Verificarea reală (sesiune validă în DB) e getCurrentUser(). */
export async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return store.has(SESSION_COOKIE_NAME);
}

/** Verificare sigură — apelează /auth/me pe backend. Memoizată per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    return await apiGet<SessionUser>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
});

export const verifySession = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await verifySession();
  if (!roles.includes(user.role)) redirect("/neautorizat");
  return user;
}
