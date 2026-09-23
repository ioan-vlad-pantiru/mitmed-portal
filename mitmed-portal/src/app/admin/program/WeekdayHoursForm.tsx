"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWeekdayHours, type WeekdayHours } from "@/actions/clinic";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

const DAY_LABELS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

// Input-urile <input type="time"> lucrează cu "HH:MM"; backend-ul întoarce
// "HH:MM:SS" — normalizăm în ambele sensuri la graniță, ca restul codului să
// nu trebuiască să știe despre asta.
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}
function fromInputTime(value: string): string | null {
  return value ? `${value}:00` : null;
}

type DayDraft = {
  weekday: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  hasBreak: boolean;
  breakStartsAt: string;
  breakEndsAt: string;
};

function toDrafts(days: WeekdayHours[]): DayDraft[] {
  return days
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => ({
      weekday: d.weekday,
      isOpen: d.is_open,
      opensAt: toInputTime(d.opens_at) || "10:00",
      closesAt: toInputTime(d.closes_at) || "18:00",
      hasBreak: Boolean(d.break_starts_at && d.break_ends_at),
      breakStartsAt: toInputTime(d.break_starts_at) || "13:00",
      breakEndsAt: toInputTime(d.break_ends_at) || "14:00",
    }));
}

function draftError(day: DayDraft): string | null {
  if (!day.isOpen) return null;
  if (day.opensAt >= day.closesAt) return `${DAY_LABELS[day.weekday]}: ora de închidere trebuie să fie după cea de deschidere.`;
  if (day.hasBreak && day.breakStartsAt >= day.breakEndsAt) {
    return `${DAY_LABELS[day.weekday]}: pauza trebuie să se termine după ce începe.`;
  }
  return null;
}

export function WeekdayHoursForm({ initial }: { initial: WeekdayHours[] }) {
  const [days, setDays] = useState<DayDraft[]>(() => toDrafts(initial));
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function patchDay(weekday: number, patch: Partial<DayDraft>) {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  const errors = days.map(draftError).filter((e): e is string => Boolean(e));

  function save() {
    if (errors.length) return;
    startTransition(async () => {
      const payload: WeekdayHours[] = days.map((d) => ({
        weekday: d.weekday,
        is_open: d.isOpen,
        opens_at: d.isOpen ? fromInputTime(d.opensAt) : null,
        closes_at: d.isOpen ? fromInputTime(d.closesAt) : null,
        break_starts_at: d.isOpen && d.hasBreak ? fromInputTime(d.breakStartsAt) : null,
        break_ends_at: d.isOpen && d.hasBreak ? fromInputTime(d.breakEndsAt) : null,
      }));
      const result = await updateWeekdayHours(payload);
      if (result.ok) {
        toast.success("Program salvat.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="mm-card overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {days.map((day) => (
          <div key={day.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <label className="flex w-32 shrink-0 items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={day.isOpen}
                onChange={(e) => patchDay(day.weekday, { isOpen: e.target.checked })}
              />
              {DAY_LABELS[day.weekday]}
            </label>

            {day.isOpen ? (
              <>
                <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                  <input
                    type="time"
                    value={day.opensAt}
                    onChange={(e) => patchDay(day.weekday, { opensAt: e.target.value })}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={day.closesAt}
                    onChange={(e) => patchDay(day.weekday, { closesAt: e.target.value })}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-sm text-zinc-500">
                  <input
                    type="checkbox"
                    checked={day.hasBreak}
                    onChange={(e) => patchDay(day.weekday, { hasBreak: e.target.checked })}
                  />
                  Pauză
                </label>
                {day.hasBreak && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                    <input
                      type="time"
                      value={day.breakStartsAt}
                      onChange={(e) => patchDay(day.weekday, { breakStartsAt: e.target.value })}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={day.breakEndsAt}
                      onChange={(e) => patchDay(day.weekday, { breakEndsAt: e.target.value })}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm text-zinc-400">Închis</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
        <div className="text-xs text-red-600">{errors[0]}</div>
        <Button type="button" onClick={save} disabled={pending || errors.length > 0}>
          {pending ? "Se salvează…" : "Salvează programul"}
        </Button>
      </div>
    </div>
  );
}
