import { NextResponse } from "next/server";
import { publicSiteCorsHeaders } from "@/lib/publicSiteCors";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

// Lista publică de terapii active (fără preț) pentru formularul de programare
// fără cont de pe mitmed.ro. API-ul nu e expus public în producție, așa că
// portalul face legătura.
export async function GET(request: Request) {
  const headers = publicSiteCorsHeaders(request.headers.get("origin"));

  try {
    const res = await fetch(`${API_BASE_URL}/public/therapies`, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json([], { status: 502, headers });
    return NextResponse.json(await res.json(), { headers });
  } catch {
    return NextResponse.json([], { status: 502, headers });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...publicSiteCorsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
