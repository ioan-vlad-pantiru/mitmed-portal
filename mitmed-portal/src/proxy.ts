import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/authSession";

const PROTECTED_PREFIXES = ["/admin", "/portal"];

// Optimistic check only (cookie presence, no API hit) — every Server Action
// and page below still calls verifySession()/requireRole() for the real
// check (a GET /auth/me against the FastAPI backend). See src/lib/authSession.ts.
//
// Deliberately NOT bouncing /login and /inregistrare away when a session
// cookie is present: the cookie only proves a session *existed* at some
// point, not that it's still valid (e.g. the backend DB was reset, or the
// session expired). If we redirected away from /login on cookie-presence
// alone, a stale cookie + an invalid session would create login <-> "/"
// redirect loop (ERR_TOO_MANY_REDIRECTS) — the real, DB-backed check on "/"
// (getCurrentUser) is what actually decides where a visitor lands.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const authed = await hasSessionCookie();
    if (!authed) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
