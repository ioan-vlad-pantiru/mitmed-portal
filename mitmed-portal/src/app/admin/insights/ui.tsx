import type { ReactNode } from "react";
import Link from "next/link";
import { formatRon } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import type { DrillQuery } from "@/actions/insights";
import { Drill } from "@/components/Drill";

export type Tone = "good" | "bad" | "flat" | "none";
export type Delta = { text: string; tone: Tone; direction: "up" | "down" | "flat" };

/** Reports round to whole RON. */
export const ron = (v: number) => formatRon(v, 0);

/**
 * How a number moved compared with the previous period, and whether that is
 * good. `higherIsBetter=false` flips the colours (e.g. cancellations).
 */
export function delta(
  current: number | null | undefined,
  previous: number | null | undefined,
  { higherIsBetter = true, points = false }: { higherIsBetter?: boolean; points?: boolean } = {},
): Delta | null {
  if (current == null || previous == null) return null;
  if (points) {
    const diff = Math.round((current - previous) * 10) / 10;
    if (Math.abs(diff) < 1) return { text: "la fel", tone: "flat", direction: "flat" };
    const up = diff > 0;
    return {
      text: `${up ? "+" : "−"}${Math.abs(diff).toLocaleString("ro-RO")} puncte`,
      tone: up === higherIsBetter ? "good" : "bad",
      direction: up ? "up" : "down",
    };
  }
  if (previous === 0) {
    if (current === 0) return { text: "la fel", tone: "flat", direction: "flat" };
    return { text: "nou față de 0", tone: higherIsBetter ? "good" : "bad", direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 3) return { text: "aproape la fel", tone: "flat", direction: "flat" };
  const up = pct > 0;
  return {
    text: `${up ? "+" : "−"}${Math.abs(Math.round(pct))}%`,
    tone: up === higherIsBetter ? "good" : "bad",
    direction: up ? "up" : "down",
  };
}

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-[var(--mm-success-bg)] text-[var(--mm-success)]",
  bad: "bg-[var(--mm-danger-bg)] text-[var(--mm-danger)]",
  flat: "bg-zinc-100 text-zinc-500",
  none: "bg-zinc-100 text-zinc-500",
};

export function DeltaChip({ d }: { d: Delta | null }) {
  if (!d) return null;
  const Icon = d.direction === "up" ? ArrowUpRight : d.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`mm-numeric inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[d.tone]}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {d.text}
    </span>
  );
}

/** A headline number. The whole card is clickable and opens the rows behind it. */
export function KpiCard({
  label,
  value,
  hint,
  d,
  previous,
  compareLabel,
  query,
  drillTitle,
  status,
}: {
  label: string;
  value: string;
  hint: string;
  d?: Delta | null;
  previous?: string | null;
  compareLabel?: string | null;
  query: DrillQuery;
  drillTitle: string;
  /** Colours the value itself when the number alone is good/bad (not a trend). */
  status?: Tone;
}) {
  const valueColor =
    status === "bad" ? "text-[var(--mm-danger)]" : status === "good" ? "text-[var(--mm-success)]" : "text-zinc-900";
  return (
    <Drill
      query={query}
      title={drillTitle}
      description={hint}
      className="mm-card group flex h-full flex-col p-4 transition-shadow hover:shadow-[var(--mm-shadow-lg)]"
    >
      <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-600">
        {label}
        <ChevronRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500" />
      </span>
      <span className={`mm-numeric mt-2 text-2xl font-bold tracking-tight sm:text-[1.7rem] ${valueColor}`}>{value}</span>
      <span className="mt-1 text-xs leading-snug text-zinc-500">{hint}</span>
      {(d || previous) && (
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-xs text-zinc-400">
          <DeltaChip d={d ?? null} />
          {previous != null && (
            <span title={compareLabel ?? undefined}>
              înainte: <span className="mm-numeric font-medium text-zinc-600">{previous}</span>
            </span>
          )}
        </span>
      )}
    </Drill>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mm-card p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type BarItem = {
  key: string;
  label: string;
  value: number;
  display: string;
  sub?: string;
  query?: DrillQuery;
  drillTitle?: string;
  /** Go straight to a page (e.g. the client's file) instead of opening a list. */
  href?: string;
  color?: string;
};

/** Horizontal bars — the clearest way to compare a handful of values. Each row is clickable. */
export function BarList({ items, empty = "Nimic de afișat în această perioadă." }: { items: BarItem[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-4 text-center text-sm text-zinc-400">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-zinc-800">{item.label}</span>
              <span className="mm-numeric shrink-0 font-semibold text-zinc-900">{item.display}</span>
            </span>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-zinc-100">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: item.color ?? "var(--mitmed-teal)" }}
              />
            </span>
            {item.sub && <span className="mt-1 block text-xs text-zinc-400">{item.sub}</span>}
          </>
        );
        const cls = "group -mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1.5 hover:bg-zinc-50";
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className={cls}>
                {body}
              </Link>
            ) : item.query ? (
              <Drill query={item.query} title={item.drillTitle ?? item.label} className={cls}>
                {body}
              </Drill>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
