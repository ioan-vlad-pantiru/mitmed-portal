import "server-only";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      // Erori de validare Pydantic — ia primul mesaj, e suficient pentru UI.
      return data.detail[0]?.msg ?? "Date invalide.";
    }
    return "A apărut o eroare.";
  } catch {
    return "A apărut o eroare.";
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** GET/POST/PUT normale — cererea poartă cookie-ul de sesiune al browserului. */
async function request<T>(
  method: string,
  path: string,
  { body, query }: { body?: unknown; query?: Query } = {}
): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method,
    headers: { "Content-Type": "application/json", Cookie: await cookieHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorDetail(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string, query?: Query) => request<T>("GET", path, { query });

/** Pentru răspunsuri non-JSON (ex: export CSV). */
export async function apiGetText(path: string, query?: Query): Promise<string> {
  const res = await fetch(buildUrl(path, query), {
    headers: { Cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorDetail(res));
  return res.text();
}
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, { body });
export const apiPut = <T>(path: string, body?: unknown) => request<T>("PUT", path, { body });
export const apiPatch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body });
export const apiDelete = <T>(path: string) => request<T>("DELETE", path, {});

/** Upload multipart — nu setăm Content-Type, ca fetch să pună singur boundary-ul. */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { Cookie: await cookieHeader() },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await parseErrorDetail(res));
  return (await res.json()) as T;
}

/**
 * Doar pentru login/register/logout — API-ul setează/șterge cookie-ul de
 * sesiune (Set-Cookie). Next.js rulează pe server, deci trebuie să citim
 * manual acel header și să-l oglindim pe cookie-jar-ul propriu, ca browserul
 * să-l primească înapoi de la Next, nu de la API direct.
 */
export async function apiAuthRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: await cookieHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const store = await cookies();
    const [pair, ...attrs] = setCookie.split(";").map((s) => s.trim());
    const eqIdx = pair.indexOf("=");
    const name = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    const maxAgeAttr = attrs.find((a) => a.toLowerCase().startsWith("max-age="));
    const maxAge = maxAgeAttr ? Number(maxAgeAttr.split("=")[1]) : undefined;

    if (value === "" || maxAge === 0) {
      store.delete(name);
    } else {
      // Reflectăm explicit `Secure` în producție — nu depindem de faptul că
      // backend-ul l-a trimis pe Set-Cookie, fiindcă acel header e consumat
      // aici și nu ajunge niciodată la browser altfel decât prin acest apel.
      store.set(name, value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge,
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorDetail(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
