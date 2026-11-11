"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ReportScope } from "@/actions/insights";
import { insightsHref } from "./href";

const SCOPES: { key: ReportScope; label: string; today: string }[] = [
  { key: "day", label: "Zi", today: "Azi" },
  { key: "month", label: "Lună", today: "Luna aceasta" },
  { key: "year", label: "An", today: "Anul acesta" },
  { key: "all", label: "Tot", today: "" },
];


/** Choose what to look at: one day, one month, one year, or everything. */
export function PeriodPicker({
  tab,
  scope,
  anchor,
  label,
  prevAnchor,
  nextAnchor,
  isCurrent,
}: {
  tab: string;
  scope: ReportScope;
  anchor: string;
  label: string;
  prevAnchor: string | null;
  nextAnchor: string | null;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (href: string) => startTransition(() => router.push(href));
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => thisYear - i);
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 aria-disabled:pointer-events-none aria-disabled:opacity-30";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Perioadă" className="flex rounded-[var(--mm-radius-md)] bg-zinc-100 p-1">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === scope}
            onClick={() => go(insightsHref(tab, s.key, s.key === "all" ? null : anchor))}
            className={`rounded-[var(--mm-radius-sm)] px-3.5 py-1.5 text-sm font-medium transition-colors ${
              s.key === scope ? "bg-white text-[var(--mitmed-teal-deep)] shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope !== "all" && (
        <div className="flex items-center gap-1 rounded-[var(--mm-radius-md)] border border-[var(--mm-border)] bg-white p-1">
          <Link
            href={prevAnchor ? insightsHref(tab, scope, prevAnchor) : "#"}
            aria-disabled={!prevAnchor}
            aria-label="Perioada anterioară"
            className={arrow}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {scope === "day" && (
            <input
              type="date"
              aria-label="Alege ziua"
              value={anchor}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && go(insightsHref(tab, scope, e.target.value))}
              className="h-9 rounded-md border-0 bg-transparent px-2 text-sm font-medium text-zinc-800 focus:ring-2 focus:ring-[var(--mitmed-sky)]"
            />
          )}
          {scope === "month" && (
            <input
              type="month"
              aria-label="Alege luna"
              value={anchor.slice(0, 7)}
              onChange={(e) => e.target.value && go(insightsHref(tab, scope, `${e.target.value}-01`))}
              className="h-9 rounded-md border-0 bg-transparent px-2 text-sm font-medium text-zinc-800 focus:ring-2 focus:ring-[var(--mitmed-sky)]"
            />
          )}
          {scope === "year" && (
            <select
              aria-label="Alege anul"
              value={anchor.slice(0, 4)}
              onChange={(e) => go(insightsHref(tab, scope, `${e.target.value}-01-01`))}
              className="h-9 rounded-md border-0 bg-transparent px-2 text-sm font-medium text-zinc-800 focus:ring-2 focus:ring-[var(--mitmed-sky)]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <Link
            href={nextAnchor ? insightsHref(tab, scope, nextAnchor) : "#"}
            aria-disabled={!nextAnchor}
            aria-label="Perioada următoare"
            className={arrow}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {scope !== "all" && !isCurrent && (
        <button
          type="button"
          onClick={() => go(insightsHref(tab, scope))}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--mitmed-teal)] hover:bg-[var(--mm-info-bg)]"
        >
          {SCOPES.find((s) => s.key === scope)?.today}
        </button>
      )}

      <span className="sr-only" aria-live="polite">
        {label}
      </span>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Se încarcă" />}
    </div>
  );
}
