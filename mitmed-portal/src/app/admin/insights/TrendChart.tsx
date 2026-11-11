"use client";

import { useState } from "react";
import type { ReportBucket } from "@/actions/insights";
import { Drill } from "@/components/Drill";

type Metric = "revenue" | "sessions" | "cancelled";

const METRICS: { key: Metric; label: string; color: string; drill: string; noun: string }[] = [
  { key: "revenue", label: "Încasări", color: "var(--mitmed-teal)", drill: "revenue", noun: "Încasări" },
  { key: "sessions", label: "Ședințe", color: "#2a78d6", drill: "sessions", noun: "Ședințe finalizate" },
  { key: "cancelled", label: "Anulări", color: "#dc2626", drill: "cancelled", noun: "Programări anulate" },
];

const UNIT_HINT: Record<string, string> = {
  hour: "pe ore",
  day: "pe zile",
  month: "pe luni",
  year: "pe ani",
};

function format(metric: Metric, v: number) {
  if (metric === "revenue") return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON`;
  return String(v);
}

function compact(metric: Metric, v: number) {
  if (!v) return "";
  if (metric === "revenue" && v >= 1000) return `${(v / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}k`;
  return metric === "revenue" ? Math.round(v).toString() : String(v);
}

/** Bars over time for the chosen period; every bar opens its own list. */
export function TrendChart({ buckets, unit, periodLabel }: { buckets: ReportBucket[]; unit: string; periodLabel: string }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const config = METRICS.find((m) => m.key === metric)!;
  const values = buckets.map((b) => b[metric]);
  const max = Math.max(1, ...values);
  const past = buckets.filter((b) => !b.future);
  const average = past.length ? past.reduce((s, b) => s + b[metric], 0) / past.length : 0;
  const best = past.reduce<ReportBucket | null>((top, b) => (!top || b[metric] > top[metric] ? b : top), null);
  const dense = buckets.length > 16;

  return (
    <section className="mm-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Evoluție {UNIT_HINT[unit]}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {periodLabel}. Apasă pe o bară ca să vezi ce e în spatele ei.
          </p>
        </div>
        <div role="tablist" className="flex rounded-[var(--mm-radius-md)] bg-zinc-100 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={m.key === metric}
              onClick={() => setMetric(m.key)}
              className={`rounded-[var(--mm-radius-sm)] px-3 py-1 text-xs font-medium transition-colors ${
                m.key === metric ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6">
        {average > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-zinc-400"
            // Bars are 11rem tall and sit above a 1.25rem label row + 0.375rem gap.
            style={{ bottom: `calc(1.625rem + ${(average / max) * 11}rem)` }}
          />
        )}
        <div
          className="grid items-end gap-[3px] sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
        >
          {buckets.map((b, i) => {
            const v = b[metric];
            const height = v ? Math.max(4, (v / max) * 100) : 0;
            const showLabel = !dense || i % Math.ceil(buckets.length / 12) === 0 || i === buckets.length - 1;
            return (
              <Drill
                key={b.key}
                query={{ metric: config.drill, start: b.start, end: b.end }}
                title={`${config.noun} · ${b.label}`}
                ariaLabel={`${b.label}: ${format(metric, v)}`}
                className="group grid min-w-0 grid-rows-[11rem_auto] gap-1.5"
              >
                <span className="relative flex items-end rounded-t-[4px] bg-zinc-50 group-hover:bg-zinc-100">
                  {!dense && v > 0 && (
                    <span
                      className="mm-numeric absolute inset-x-0 text-center text-[10px] font-semibold text-zinc-600"
                      style={{ bottom: `calc(${height}% + 2px)` }}
                    >
                      {compact(metric, v)}
                    </span>
                  )}
                  <span
                    className="block w-full rounded-t-[4px] transition-[height,opacity] group-hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      backgroundColor: config.color,
                      opacity: b.future ? 0.35 : 1,
                    }}
                  />
                  <span className="pointer-events-none absolute -top-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white group-hover:block">
                    {b.label}: {format(metric, v)}
                  </span>
                </span>
                <span
                  className={`block h-[1.25rem] truncate text-center text-[10px] font-medium ${
                    b.weekend ? "text-zinc-300" : "text-zinc-500"
                  }`}
                >
                  {showLabel ? b.label : ""}
                </span>
              </Drill>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-zinc-400" /> Media:{" "}
          <span className="mm-numeric font-semibold text-zinc-700">{format(metric, Math.round(average))}</span>
        </span>
        {best && best[metric] > 0 && (
          <span>
            Cel mai bun: <span className="font-semibold text-zinc-700">{best.label}</span> (
            <span className="mm-numeric">{format(metric, best[metric])}</span>)
          </span>
        )}
      </div>
    </section>
  );
}
