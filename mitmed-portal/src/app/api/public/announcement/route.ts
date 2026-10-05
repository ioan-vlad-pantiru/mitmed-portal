import { NextResponse } from "next/server";
import { publicSiteCorsHeaders } from "@/lib/publicSiteCors";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
const HIDDEN = { enabled: false, text: null, mobile_text: null };

// Bara portocalie de anunț de pe mitmed.ro (export static, citește live de
// aici). Fără cache, ca o modificare din Setări să apară imediat pe site.
export async function GET(request: Request) {
  const headers = publicSiteCorsHeaders(request.headers.get("origin"));

  try {
    const res = await fetch(`${API_BASE_URL}/public/announcement`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json(HIDDEN, { status: 502, headers });
    return NextResponse.json(await res.json(), { headers });
  } catch {
    return NextResponse.json(HIDDEN, { status: 502, headers });
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
