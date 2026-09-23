"use client";

import { useEffect, useState } from "react";

/** Linia "acum" din calendarul săptămânal, la fel ca-n Google Calendar —
 * client component separat (nu tot WeekCalendar), ca restul grilei să rămână
 * randat pe server; doar poziția orei curente trebuie să "tremure" pe
 * client. Nu randează nimic până la primul efect (evită un mismatch
 * server/client de oră) și se actualizează la fiecare minut. */
export function CalendarNowLine({
  day,
  dayStartHour,
  dayEndHour,
  hourPx,
}: {
  day: Date;
  dayStartHour: number;
  dayEndHour: number;
  hourPx: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;
  const isToday =
    now.getFullYear() === day.getFullYear() && now.getMonth() === day.getMonth() && now.getDate() === day.getDate();
  if (!isToday) return null;

  const minutesFromStart = (now.getHours() - dayStartHour) * 60 + now.getMinutes();
  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null;

  const top = (minutesFromStart / 60) * hourPx;
  const label = now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pointer-events-none absolute left-0 right-0 z-[6] flex items-center gap-1" style={{ top }}>
      <span className="rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap text-white">
        {label}
      </span>
      <span className="h-px flex-1 bg-red-500" />
    </div>
  );
}
