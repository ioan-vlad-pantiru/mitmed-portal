// Origini permise să apeleze cross-origin rutele publice ale portalului
// (/api/session, /api/public/*) — site-ul de prezentare (mitmed.ro) are
// nevoie de ele pentru starea sesiunii și programarea fără cont. Fără
// verificarea asta, orice site terț ar putea sonda dacă cineva e logat sau
// ar putea trimite cereri de programare în numele nostru.
const ALLOWED_ORIGINS = (process.env.PUBLIC_SITE_ORIGINS ?? "https://mitmed.ro,https://www.mitmed.ro")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

export function publicSiteCorsHeaders(origin: string | null): HeadersInit {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
