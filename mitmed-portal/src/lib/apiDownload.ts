import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

/** Oglindește o descărcare binară (ex. PDF) de la API către browser, cu
 * cookie-ul de sesiune — un Server Action nu poate întoarce un fișier.
 * Autorizarea rămâne pe API; apelantul verifică doar rolul. */
export async function proxyApiDownload(path: string): Promise<NextResponse> {
  const store = await cookies();
  const apiRes = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Cookie: store.toString() },
    cache: "no-store",
  });

  if (!apiRes.ok) {
    const body = await apiRes.text();
    return new NextResponse(body, { status: apiRes.status });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = apiRes.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(apiRes.body, { headers });
}
