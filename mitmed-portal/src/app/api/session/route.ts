import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authSession";
import { publicSiteCorsHeaders } from "@/lib/publicSiteCors";

// Starea sesiunii pentru site-ul de prezentare (mitmed.ro): dacă vizitatorul
// e deja autentificat în portal, butonul „Programează-te" îl trimite direct
// la programare, iar header-ul îi arată meniul de cont. Originile permise:
// vezi src/lib/publicSiteCors.ts.
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const user = await getCurrentUser();

  return NextResponse.json(
    user ? { authenticated: true, firstName: user.full_name?.split(" ")[0] ?? null } : { authenticated: false },
    { headers: publicSiteCorsHeaders(origin) }
  );
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...publicSiteCorsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
