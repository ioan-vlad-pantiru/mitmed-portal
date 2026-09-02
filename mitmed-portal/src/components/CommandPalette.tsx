"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSummary } from "@/actions/clients";
import { IconSearch, IconUsers, IconCalendar } from "@/components/icons";

/** Căutare rapidă globală (Cmd/Ctrl+K) — găsește un client după nume/telefon
 * și oferă direct fișa lui sau, dacă are o programare azi, intrarea în consult.
 * Fără roundtrip de rețea la fiecare tastă: lista de clienți vine deja
 * încărcată din layout-ul admin, cmdk filtrează local. */
export function CommandPalette({
  clients,
  todayAppointmentByClient,
}: {
  clients: ClientSummary[];
  todayAppointmentByClient: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
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
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-[var(--mitmed-mist)]/80 transition-colors hover:bg-white/15 hover:text-[var(--mitmed-mist)]"
      >
        <IconSearch className="h-4 w-4" />
        <span className="hidden sm:inline">Caută client…</span>
        <kbd className="hidden rounded border border-white/20 px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Căutare rapidă"
        overlayClassName="fixed inset-0 z-40 bg-zinc-900/40"
        contentClassName="fixed left-1/2 top-[15%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-[var(--mm-radius-lg)] bg-white shadow-[var(--mm-shadow-lg)] focus:outline-none"
        shouldFilter
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-zinc-400" />
          <Command.Input
            autoFocus
            placeholder="Caută un client după nume sau telefon…"
            className="w-full bg-transparent py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-400">Niciun rezultat.</Command.Empty>

          <Command.Group heading="Acțiuni" className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            <Command.Item
              onSelect={() => go("/admin/clienti")}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-[var(--mitmed-sky)]/12 aria-selected:text-[var(--mitmed-teal-deep)]"
            >
              <IconUsers className="h-4 w-4 text-zinc-400" />
              Toți clienții
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Clienți" className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {clients.map((c) => {
              const appointmentId = todayAppointmentByClient[c.id];
              return (
                <Command.Item
                  key={c.id}
                  value={`${c.full_name} ${c.phone ?? ""} ${c.email}`}
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
