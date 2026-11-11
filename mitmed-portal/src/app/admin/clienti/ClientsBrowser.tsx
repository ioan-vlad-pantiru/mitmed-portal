"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Phone, Search, UserPlus, X } from "lucide-react";
import type { ClientSummary } from "@/actions/clients";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CLINIC_TIME_ZONE } from "@/lib/clinic";
import { formatRon } from "@/lib/format";
import { CreateClientForm } from "./CreateClientForm";

type Filter = "all" | "upcoming" | "due" | "at_risk" | "new" | "inactive";
type Sort = "recent" | "name" | "last_visit" | "next_visit";

const DAY = 86_400_000;

/** Lower-case, no diacritics: "Ștefănescu" matches "stefanescu". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function daysAgo(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  if (days < 30) return `acum ${days} zile`;
  const months = Math.floor(days / 30);
  return months < 12 ? `acum ${months} ${months === 1 ? "lună" : "luni"}` : `acum ${Math.floor(months / 12)} ani`;
}

function upcomingLabel(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

/** Searchable, filterable client list; the whole row opens the client file. */
export function ClientsBrowser({ clients, openNewClient }: { clients: ClientSummary[]; openNewClient: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [newOpen, setNewOpen] = useState(openNewClient);
  const [now] = useState(() => Date.now());

  const filters = useMemo<{ key: Filter; label: string; test: (c: ClientSummary) => boolean }[]>(() => [
    { key: "all", label: "Toți", test: () => true },
    { key: "upcoming", label: "Programați", test: (c) => Boolean(c.next_visit) },
    { key: "due", label: "De încasat", test: (c) => c.amount_due > 0 },
    { key: "at_risk", label: "Nu au mai venit", test: (c) => c.at_risk },
    { key: "new", label: "Noi (30 de zile)", test: (c) => Boolean(c.created_at) && now - new Date(c.created_at!).getTime() < 30 * DAY },
    { key: "inactive", label: "Cont inactiv", test: (c) => c.status !== "ACTIVE" },
  ], [now]);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    const digits = query.replace(/\D/g, "");
    const test = filters.find((f) => f.key === filter)!.test;
    const list = clients.filter((c) => {
      if (!test(c)) return false;
      if (!q) return true;
      return (
        normalize(c.full_name).includes(q) ||
        normalize(c.email ?? "").includes(q) ||
        (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    });
    const time = (iso: string | null, empty: number) => (iso ? new Date(iso).getTime() : empty);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"));
    if (sort === "last_visit") sorted.sort((a, b) => time(b.last_visit, 0) - time(a.last_visit, 0));
    if (sort === "next_visit") sorted.sort((a, b) => time(a.next_visit, Infinity) - time(b.next_visit, Infinity));
    return sorted;
  }, [clients, filters, query, filter, sort]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Clienți</h1>
          <p className="text-sm text-zinc-500">{clients.length} în total. Apasă pe un client ca să-i deschizi fișa.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <UserPlus size={16} /> Client nou
        </Button>
      </div>

      <div className="mm-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full min-w-0 sm:w-auto sm:flex-1">
            <span className="sr-only">Caută client</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută după nume, telefon sau email"
              className="mm-input h-11 w-full pl-10 pr-9 text-base"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Șterge căutarea"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <label className="flex w-full items-center gap-2 text-sm text-zinc-500 sm:w-auto sm:shrink-0">
            Ordonează
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="mm-input h-11 min-w-0 flex-1 py-0 text-sm sm:w-56 sm:flex-none">
              <option value="recent">Adăugați recent</option>
              <option value="name">Nume (A–Z)</option>
              <option value="last_visit">Ultima vizită</option>
              <option value="next_visit">Următoarea programare</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtre">
          {filters.map((f) => {
            const count = clients.filter(f.test).length;
            if (f.key === "inactive" && count === 0) return null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--mitmed-teal)] bg-[var(--mitmed-teal)] text-white"
                    : "border-[var(--mm-border-strong)] bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {f.label}
                <span className={`mm-numeric text-xs ${active ? "text-white/80" : "text-zinc-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mm-card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_1.25rem] gap-4 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5 text-xs font-medium text-zinc-500 md:grid">
          <span>Client</span>
          <span>Ultima vizită</span>
          <span>Următoarea programare</span>
          <span>De încasat</span>
          <span />
        </div>
        <ul className="divide-y divide-zinc-100">
          {shown.map((c) => (
            <li key={c.id} className="relative">
              <Link
                href={`/admin/clienti/${c.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_1.25rem]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mm-info-bg)] text-sm font-semibold text-[var(--mitmed-teal)]">
                    {c.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-zinc-900">{c.full_name}</span>
                      {c.status !== "ACTIVE" && <span className="mm-badge" data-variant="neutral">{c.status === "PENDING" ? "în așteptare" : "suspendat"}</span>}
                      {c.at_risk && <span className="mm-badge" data-variant="warning">nu a mai venit</span>}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "fără date de contact"}
                    </span>
                  </span>
                </span>
                <span className="text-sm text-zinc-600 max-md:col-start-1 max-md:pl-12 max-md:text-xs">
                  {c.last_visit ? (
                    <>
                      <span className="md:hidden">Ultima vizită: </span>
                      {daysAgo(c.last_visit, now)}
                      <span className="text-zinc-400"> · {c.visits} {c.visits === 1 ? "ședință" : "ședințe"}</span>
                    </>
                  ) : (
                    <span className="text-zinc-400">Nicio vizită încă</span>
                  )}
                </span>
                <span className="text-sm max-md:col-start-1 max-md:pl-12 max-md:text-xs">
                  {c.next_visit ? (
                    <span className="font-medium text-[var(--mitmed-teal)]">
                      <span className="md:hidden">Programat: </span>
                      {upcomingLabel(c.next_visit)}
                    </span>
                  ) : (
                    <span className="text-zinc-400 max-md:hidden">—</span>
                  )}
                </span>
                <span className="text-sm max-md:col-start-2 max-md:row-start-1 max-md:justify-self-end">
                  {c.amount_due > 0 ? (
                    <span className="mm-badge" data-variant="warning">{formatRon(c.amount_due, 0)}</span>
                  ) : (
                    <span className="text-zinc-400 max-md:hidden">—</span>
                  )}
                </span>
                <ChevronRight size={18} className="hidden text-zinc-300 md:block" />
              </Link>
              {c.phone && (
                <a
                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                  aria-label={`Sună pe ${c.full_name}`}
                  className="absolute right-3 bottom-2 grid h-9 w-9 place-items-center rounded-full text-[var(--mitmed-teal)] hover:bg-[var(--mm-info-bg)] md:hidden"
                >
                  <Phone size={17} />
                </a>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {query ? `Niciun client găsit pentru „${query}”.` : "Niciun client în această categorie."}
          </p>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen} title="Client nou" description="Pentru clienții care nu își fac singuri cont din portal." size="lg">
        <CreateClientForm />
      </Dialog>
    </section>
  );
}
