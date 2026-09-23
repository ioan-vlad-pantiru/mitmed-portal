import { NextResponse } from "next/server";
import { isAllowedOrigin, publicSiteCorsHeaders } from "@/lib/publicSiteCors";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

// Cerere de programare fără cont, trimisă de pe mitmed.ro. Doar transmite
// cererea către API (POST /public/booking-requests), care o salvează pentru
// confirmare manuală în /admin/cereri. IP-ul vizitatorului (setat de Caddy
// în X-Forwarded-For) merge mai departe, ca limita per-IP din API să se
// aplice per vizitator, nu per container.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = publicSiteCorsHeaders(origin);

  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ detail: "Origine nepermisă." }, { status: 403, headers });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Date invalide." }, { status: 400, headers });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  try {
    const res = await fetch(`${API_BASE_URL}/public/booking-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status, headers });
  } catch {
    return NextResponse.json({ detail: "Serviciul nu este disponibil momentan." }, { status: 502, headers });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...publicSiteCorsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
