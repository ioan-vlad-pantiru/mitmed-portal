"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getInsightsDrilldown, type DrillQuery, type DrillRow } from "@/actions/insights";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/clinicTime";
import { formatRon } from "@/lib/format";

/**
 * Wraps any number, bar or row on the insights page: clicking it opens the
 * list of appointments, payments or clients that make up that number.
 */
export function Drill({
  query,
  title,
  description,
  children,
  className = "",
  ariaLabel,
}: {
  query: DrillQuery;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DrillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setError(null);
    getInsightsDrilldown(query)
      .then(setRows)
      .catch(() => setError("Nu am putut încărca lista. Încearcă din nou."));
  }

  const total = rows?.reduce((sum, r) => sum + (r.amount ?? 0), 0) ?? 0;
  const hasAmounts = rows?.some((r) => r.amount !== null) ?? false;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={ariaLabel}
        className={`cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mitmed-sky)] ${className}`}
      >
        {children}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setRows(null);
        }}
        title={title}
        description={description}
        size="lg"
      >
        {error && <p role="alert" className="mm-alert" data-variant="danger">{error}</p>}
        {!error && rows === null && <p className="py-8 text-center text-sm text-zinc-400">Se încarcă…</p>}
        {rows && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">Nu e nimic de afișat pentru această selecție.</p>
        )}
        {rows && rows.length > 0 && (
          <>
            <div className="mb-2 flex items-baseline justify-between text-xs text-zinc-500">
              <span>
                {rows.length} {rows.length === 1 ? "înregistrare" : "înregistrări"}
              </span>
              {hasAmounts && <span className="mm-numeric font-semibold text-zinc-800">Total {formatRon(total)}</span>}
            </div>
            <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto overflow-x-hidden px-2 -mx-2">
              {rows.map((row) => {
                const body = (
                  <div className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {row.client_name && row.client_name !== row.title ? (
                          <>
                            {row.client_name} <span className="font-normal text-zinc-500">· {row.title}</span>
                          </>
                        ) : (
                          row.title
                        )}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {[row.date ? formatDateTime(row.date) : null, row.subtitle].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {row.badge && <Badge variant={row.badge.tone}>{row.badge.label}</Badge>}
                    {row.amount !== null && (
                      <span className="mm-numeric w-24 shrink-0 text-right text-sm font-semibold text-zinc-900">
                        {formatRon(row.amount)}
                      </span>
                    )}
                    {row.href && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />}
                  </div>
                );
                return (
                  <li key={row.key}>
                    {row.href ? (
                      <Link href={row.href} className="-mx-2 block rounded-md px-2 hover:bg-zinc-50">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Dialog>
    </>
  );
}
