import Link from "next/link";
import { Check, ClipboardList, Phone, Stethoscope } from "lucide-react";
import type { CalendarAppointmentApi } from "@/actions/appointments";
import { formatTime } from "@/lib/clinicTime";

type Visit = CalendarAppointmentApi;

const UNPAID = new Set(["NEPLATIT", "PARTIAL"]);

/**
 * A day's visits in time order. For today the visit happening now (or next)
 * is highlighted with the consult button, finished ones are ticked, and visits
 * whose time has passed without being finished ask to be finalized.
 */
export function DaySchedule({
  title,
  visits,
  now,
  isToday,
  empty,
}: {
  title: string;
  visits: Visit[];
  now: number;
  isToday: boolean;
  empty: string;
}) {
  const active = visits.filter((v) => v.status !== "ANULATA");
  const endsAt = (v: Visit) => new Date(v.starts_at).getTime() + v.duration_minutes * 60_000;
  const isOpen = (v: Visit) => v.status === "PROGRAMATA" || v.status === "CONFIRMATA";
  // The visit to focus on: the first open one that hasn't ended yet.
  const focusId = isToday ? active.find((v) => isOpen(v) && endsAt(v) > now)?.id : undefined;
  const cancelled = visits.length - active.length;

  return (
    <section className="mm-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
        <span className="text-sm text-zinc-500">
          {active.length} {active.length === 1 ? "programare" : "programări"}
          {cancelled > 0 && ` · ${cancelled} anulate`}
        </span>
      </div>
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {active.map((v) => {
            const done = v.status === "FINALIZATA";
            const overdue = isToday && isOpen(v) && endsAt(v) <= now;
            const focus = v.id === focusId;
            return (
              <li
                key={v.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--mm-radius-md)] border px-3 py-2.5 ${
                  focus
                    ? "border-[var(--mitmed-teal)] bg-[var(--mm-info-bg)]"
                    : overdue
                      ? "border-amber-200 bg-[var(--mm-warning-bg)]"
                      : "border-[var(--mm-border)]"
                } ${done ? "opacity-70" : ""}`}
              >
                <span className={`mm-numeric w-14 shrink-0 text-lg font-bold ${done ? "text-zinc-400" : "text-zinc-900"}`}>
                  {formatTime(v.starts_at)}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/clienti/${v.client_id}`} className="block truncate font-semibold text-zinc-900 hover:underline">
                    {v.client_name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                    <span>
                      {v.therapy_name} · {v.duration_minutes} min
                    </span>
                    {v.client_phone && (
                      <a href={`tel:${v.client_phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-[var(--mitmed-teal)] hover:underline">
                        <Phone size={12} /> {v.client_phone}
                      </a>
                    )}
                    {v.payment_status && UNPAID.has(v.payment_status) && (
                      <span className="font-semibold text-amber-700">{v.payment_status === "PARTIAL" ? "plătit parțial" : "neplătit"}</span>
                    )}
                    {v.booked_by_client && <span>rezervată online</span>}
                  </span>
                </span>
                {done ? (
                  <Link href={`/admin/consult/${v.id}`} className="mm-btn" data-variant="ghost">
                    <Check size={15} className="text-[var(--mm-success)]" /> Vezi fișa
                  </Link>
                ) : overdue ? (
                  <Link href={`/admin/consult/${v.id}`} className="mm-btn" data-variant="secondary">
                    <ClipboardList size={15} /> Finalizează
                  </Link>
                ) : isToday ? (
                  <Link href={`/admin/consult/${v.id}`} className="mm-btn" data-variant={focus ? "primary" : "secondary"}>
                    <Stethoscope size={15} /> {focus ? "Intră în consult" : "Consult"}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
