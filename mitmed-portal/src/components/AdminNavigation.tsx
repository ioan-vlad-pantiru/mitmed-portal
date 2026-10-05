"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ClientSummary } from "@/actions/clients";
import { ADMIN_PAGES, CLIENT_TABS, findAdminPage, rememberRecentClient } from "@/lib/adminRoutes";

type Crumb = { href: string; label: string };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Lanțul de pagini până la cea curentă (Bord › Setări › Terapii, sau
 * Bord › Clienți › Nume › Tab) — ultimul element e pagina curentă. */
function buildCrumbs(pathname: string, tab: string | null, clientName: (id: string) => string): Crumb[] {
  const clientMatch = pathname.match(/^\/admin\/clienti\/([^/]+)$/);
  if (clientMatch) {
    const id = clientMatch[1];
    const crumbs = [
      { href: "/admin", label: "Bord" },
      { href: "/admin/clienti", label: "Clienți" },
      { href: `/admin/clienti/${id}`, label: clientName(id) },
    ];
    if (tab && CLIENT_TABS[tab] && tab !== "profil") {
      crumbs.push({ href: `/admin/clienti/${id}?tab=${tab}`, label: CLIENT_TABS[tab] });
    }
    return crumbs;
  }
  const crumbs: Crumb[] = [];
  let page = findAdminPage(pathname);
  while (page) {
    crumbs.unshift({ href: page.href, label: page.label });
    page = page.parent ? findAdminPage(page.parent) : undefined;
  }
  return crumbs;
}

function parentHref(pathname: string): string {
  if (/^\/admin\/clienti\/[^/]+$/.test(pathname)) return "/admin/clienti";
  return findAdminPage(pathname)?.parent ?? "/admin";
}

/** Bara „Înapoi” + breadcrumbs din capul fiecărei pagini de admin, plus
 * scurtăturile de tastatură „g + tastă” (g b = Bord, g c = Clienți etc.).
 *
 * „Înapoi” întoarce la pagina de dinainte din aplicație (ca butonul browserului,
 * ex. Bord → client → Înapoi = Bord); dacă pagina a fost deschisă direct,
 * duce la pagina-părinte (ex. Terapii → Setări). */
export function AdminNavigation({ clients, isAdmin }: { clients: ClientSummary[]; isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab");
  const location = `${pathname}${tab ? `?tab=${tab}` : ""}`;
  // Istoricul de navigare din sesiunea curentă a aplicației.
  const history = useRef<string[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const stack = history.current;
    if (stack[stack.length - 2] === location) stack.pop(); // a fost un „înapoi”
    else if (stack[stack.length - 1] !== location) stack.push(location);
    setCanGoBack(stack.length > 1);

    const clientMatch = pathname.match(/^\/admin\/clienti\/([^/]+)$/);
    if (clientMatch) rememberRecentClient(clientMatch[1]);
  }, [location, pathname]);

  // g + tastă: sare direct la o secțiune principală.
  useEffect(() => {
    let armedUntil = 0;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "g") {
        armedUntil = Date.now() + 1200;
        return;
      }
      if (Date.now() > armedUntil) return;
      armedUntil = 0;
      const page = ADMIN_PAGES.find((p) => p.shortcut === key && (isAdmin || !p.adminOnly));
      if (page) {
        e.preventDefault();
        router.push(page.href);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, isAdmin]);

  // Bordul e pagina de start; ecranul de Consult are propriul cap cu ieșire.
  if (pathname === "/admin" || pathname.startsWith("/admin/consult/")) return null;

  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name ?? "Client";
  const crumbs = buildCrumbs(pathname, tab, clientName);

  return (
    <div className="mb-5 flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => (canGoBack ? router.back() : router.push(parentHref(pathname)))}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mitmed-sky)]"
        title="Înapoi"
      >
        <ArrowLeft className="h-4 w-4" /> Înapoi
      </button>
      {crumbs.length > 0 && (
        <nav aria-label="Unde te afli" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1 text-sm text-zinc-500">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                // Pe telefon rămân vizibile doar ultimele două niveluri.
                <li key={crumb.href} className={`min-w-0 items-center gap-1 ${i < crumbs.length - 2 ? "hidden sm:flex" : "flex"}`}>
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" aria-hidden />}
                  {last ? (
                    <span aria-current="page" className="truncate font-medium text-zinc-900">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="truncate hover:text-zinc-900 hover:underline">{crumb.label}</Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}
