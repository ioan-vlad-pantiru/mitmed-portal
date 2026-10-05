"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSummary } from "@/actions/clients";
import { CornerDownRight, History } from "lucide-react";
import { IconSearch, IconUsers, IconCalendar } from "@/components/icons";
import { ADMIN_PAGES, readRecentClientIds } from "@/lib/adminRoutes";

// Stilul de titlu se aplică doar titlului grupului (atributul cmdk-group-heading),
// nu întregului grup — altfel și numele clienților apăreau cu majuscule.
const GROUP_CLASS =
  "px-2 py-1 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-zinc-400";

/** Căutare rapidă globală (Cmd/Ctrl+K) — găsește un client după nume/telefon
 * și oferă direct fișa lui sau, dacă are o programare azi, intrarea în consult.
 * Arată și clienții deschiși recent și sare la orice pagină din admin.
 * Fără roundtrip de rețea la fiecare tastă: lista de clienți vine deja
 * încărcată din layout-ul admin, cmdk filtrează local. */
export function CommandPalette({
  clients,
  todayAppointmentByClient,
  isAdmin,
}: {
  clients: ClientSummary[];
  todayAppointmentByClient: Record<string, string>;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const pages = ADMIN_PAGES.filter((p) => isAdmin || !p.adminOnly);
  const recentClients = recentIds
    .map((id) => clients.find((c) => c.id === id))
    .filter((c): c is ClientSummary => Boolean(c));

  function setOpenAndRefresh(next: boolean | ((v: boolean) => boolean)) {
    setOpen((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      if (value) setRecentIds(readRecentClientIds());
      return value;
    });
  }
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenAndRefresh((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpenAndRefresh(true)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-[var(--mitmed-mist)]/80 transition-colors hover:bg-white/15 hover:text-[var(--mitmed-mist)]"
      >
        <IconSearch className="h-4 w-4" />
        <span className="hidden sm:inline">Caută client sau pagină…</span>
        <kbd className="hidden rounded border border-white/20 px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpenAndRefresh}
        label="Căutare rapidă"
        overlayClassName="fixed inset-0 z-40 bg-zinc-900/40"
        contentClassName="fixed left-1/2 top-[15%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-[var(--mm-radius-lg)] bg-white shadow-[var(--mm-shadow-lg)] focus:outline-none"
        shouldFilter
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-zinc-400" />
          <Command.Input
            autoFocus
            placeholder="Caută un client (nume, telefon) sau o pagină…"
            className="w-full bg-transparent py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-400">Niciun rezultat.</Command.Empty>

          {recentClients.length > 0 && (
            <Command.Group heading="Deschiși recent" className={GROUP_CLASS}>
              {recentClients.map((c) => (
                <Command.Item
                  key={`recent-${c.id}`}
                  value={`recent ${c.full_name} ${c.phone ?? ""}`}
                  onSelect={() => go(`/admin/clienti/${c.id}`)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-[var(--mitmed-sky)]/12 aria-selected:text-[var(--mitmed-teal-deep)]"
                >
                  <History className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{c.full_name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Pagini" className={GROUP_CLASS}>
            {pages.map((p) => (
              <Command.Item
                key={p.href}
                value={`pagina ${p.label} ${p.keywords ?? ""}`}
                onSelect={() => go(p.href)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-[var(--mitmed-sky)]/12 aria-selected:text-[var(--mitmed-teal-deep)] justify-between"
              >
                <span className="flex items-center gap-2.5">
                  <CornerDownRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  {p.label}
                </span>
                {p.shortcut && <kbd className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-400">g {p.shortcut}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Acțiuni" className={GROUP_CLASS}>
            <Command.Item
              onSelect={() => go("/admin/clienti")}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-[var(--mitmed-sky)]/12 aria-selected:text-[var(--mitmed-teal-deep)]"
            >
              <IconUsers className="h-4 w-4 text-zinc-400" />
              Toți clienții
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Clienți" className={GROUP_CLASS}>
            {clients.map((c) => {
              const appointmentId = todayAppointmentByClient[c.id];
              return (
                <Command.Item
                  key={c.id}
                  value={`${c.full_name} ${c.phone ?? ""} ${c.email ?? ""}`}
                  onSelect={() => go(appointmentId ? `/admin/consult/${appointmentId}` : `/admin/clienti/${c.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-[var(--mitmed-sky)]/12 aria-selected:text-[var(--mitmed-teal-deep)]"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <IconUsers className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">{c.full_name}</span>
                    {c.phone && <span className="shrink-0 text-xs text-zinc-400">{c.phone}</span>}
                  </span>
                  {appointmentId && (
                    <span className="mm-badge shrink-0" data-variant="success">
                      <IconCalendar className="h-3 w-3" /> azi
                    </span>
                  )}
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </>
  );
}
