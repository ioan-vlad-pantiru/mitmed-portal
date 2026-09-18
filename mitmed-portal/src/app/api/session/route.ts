import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authSession";

// Origini permise să interogheze starea sesiunii cross-origin — site-ul de
// prezentare (mitmed.ro, export static) are nevoie să știe dacă vizitatorul
// e deja autentificat în portal, ca să-l trimită direct la programare în loc
// de login. Fără verificarea asta, orice site terț ar putea sonda dacă
// cineva e logat (cookie-ul e httpOnly, dar prezența unei sesiuni valide nu
// e un secret pe care vrem să-l expunem oricui).
const ALLOWED_ORIGINS = (process.env.PUBLIC_SITE_ORIGINS ?? "https://mitmed.ro,https://www.mitmed.ro")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const user = await getCurrentUser();

  return NextResponse.json(
    user ? { authenticated: true, firstName: user.full_name?.split(" ")[0] ?? null } : { authenticated: false },
    { headers: corsHeaders(origin) }
  );
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
