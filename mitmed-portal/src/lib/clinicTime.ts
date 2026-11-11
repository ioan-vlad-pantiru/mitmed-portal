import { CLINIC_TIME_ZONE } from "@/lib/clinic";

/** Date/time formatting, always in the clinic's time zone — a visit shows the
 * same time on the server, in the admin and on any client's phone. */

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: CLINIC_TIME_ZONE,
  });
}

/** "13 nov. 2026, 10:00" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIME_ZONE });
}

/** "YYYY-MM-DD" of an instant, in the clinic's time zone. */
export function clinicDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIME_ZONE });
}

/** "Astăzi" / "Mâine" / "Peste 3 zile" / "joi, 14 noiembrie". */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const diff = Math.round(
    (Date.parse(`${clinicDayKey(new Date(iso))}T00:00:00Z`) - Date.parse(`${clinicDayKey(now)}T00:00:00Z`)) / 86_400_000
  );
  if (diff === 0) return "Astăzi";
  if (diff === 1) return "Mâine";
  if (diff > 1 && diff <= 6) return `Peste ${diff} zile`;
  const day = formatDay(iso);
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Local wall-clock parts of an instant in the clinic's zone, for calendar files. */
export function clinicLocalStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
