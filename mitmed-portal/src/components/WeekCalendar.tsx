import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { CalendarNowLine } from "@/components/CalendarNowLine";
import { formatBooking } from "@/lib/clinic";

const DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19; // interval afișat pe grilă; orele reale ale cabinetului sunt 10–18
const LUNCH_BREAK_HOUR = 13; // pauza 13:00–14:00, fără programări
const HOUR_PX = 64;

export type CalendarAppointment = {
  id: string;
  clientId: string;
  clientName: string;
  therapyId: string;
  therapyName: string;
  startsAt: string; // ISO
  bookedAt: string; // ISO — momentul rezervării
  bookedByClient: boolean;
  durationMinutes: number;
  status: string;
};

// Paletă de culori pe brand-ul MitMed + câteva nuanțe complementare — asignată
// stabil per terapie (după poziția în lista de terapii), nu la întâmplare.
const THERAPY_PALETTE = [
  { bg: "bg-[var(--mitmed-sky)]/25", border: "border-[var(--mitmed-sky)]", text: "text-[var(--mitmed-teal-deep)]" },
  { bg: "bg-[var(--mitmed-teal)]/20", border: "border-[var(--mitmed-teal)]", text: "text-[var(--mitmed-teal-deep)]" },
  { bg: "bg-[var(--mitmed-orange)]/20", border: "border-[var(--mitmed-orange)]", text: "text-orange-900" },
  { bg: "bg-violet-200/60", border: "border-violet-400", text: "text-violet-900" },
  { bg: "bg-rose-200/60", border: "border-rose-400", text: "text-rose-900" },
  { bg: "bg-emerald-200/60", border: "border-emerald-400", text: "text-emerald-900" },
];

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekRange(weekParam: string | undefined) {
  const base = weekParam ? new Date(`${weekParam}T00:00:00`) : new Date();
  const monday = Number.isNaN(base.getTime()) ? mondayOf(new Date()) : mondayOf(base);
  const start = monday;
  const end = new Date(monday);
  end.setDate(end.getDate() + 7); // exclusiv — acoperă Luni–Duminică, deși afișăm doar Luni–Vineri
  return { start, end };
}

function toDateParam(d: Date) {
  // NU d.toISOString() — aia convertește la UTC, iar pe un fus orar înaintea
  // UTC (ex. România, EEST = UTC+3), miezul nopții local devine ziua
  // anterioară în UTC. Rezultatul: click pe "săptămâna viitoare" trimitea
  // uneori o dată de duminică din săptămâna curentă, pe care mondayOf() o
  // interpreta ca aparținând tot săptămânii afișate — butonul de dreapta
  // părea că nu face nimic. Construim string-ul din componentele LOCALE.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeekCalendar({
  weekStart,
  appointments,
  therapyOrder,
}: {
  weekStart: Date;
  appointments: CalendarAppointment[];
  therapyOrder: string[]; // therapy ids, în ordinea folosită pentru culori
}) {
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const totalHeight = hours.length * HOUR_PX;

  const rangeLabel = `${days[0].toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} – ${days[4].toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}`;
  const scheduledCount = appointments.filter((appointment) => appointment.status === "PROGRAMATA" || appointment.status === "CONFIRMATA").length;

  const colorForTherapy = (therapyId: string) => {
    const idx = therapyOrder.indexOf(therapyId);
    return THERAPY_PALETTE[(idx < 0 ? 0 : idx) % THERAPY_PALETTE.length];
  };

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  return (
    <div className="mm-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/50 px-5 py-3.5">
        <div><span className="text-sm font-semibold tracking-tight text-zinc-800">{rangeLabel}</span><span className="ml-2 text-xs text-zinc-400">{scheduledCount} programări active</span></div>
        <div className="flex items-center gap-1">
          <Link
            href={`/admin?week=${toDateParam(prevWeek)}`}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800"
            aria-label="Săptămâna trecută"
          >
            <IconChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href="/admin"
            className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--mitmed-teal)] transition-colors hover:bg-white"
          >
            Astăzi
          </Link>
          <Link
            href={`/admin?week=${toDateParam(nextWeek)}`}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800"
            aria-label="Săptămâna viitoare"
          >
            <IconChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain">
        <div className="grid min-w-[720px] grid-cols-[56px_repeat(5,1fr)]">
          <div />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={`border-b border-l border-zinc-100 px-2 py-2.5 text-center ${isToday(d) ? "bg-[var(--mitmed-sky)]/[0.06]" : ""}`}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{DAY_NAMES[d.getDay() - 1]}</div>
              <div
                className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday(d) ? "bg-[var(--mitmed-teal)] text-white" : "text-zinc-800"
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          ))}

          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-zinc-100 pr-2 text-right text-[11px] text-zinc-400"
                style={{ top: i * HOUR_PX }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayAppointments = appointments.filter((a) => {
              const start = new Date(a.startsAt);
              return (
                start.getFullYear() === day.getFullYear() &&
                start.getMonth() === day.getMonth() &&
                start.getDate() === day.getDate()
              );
            });

            return (
              <div
                key={day.toISOString()}
                className={`relative border-l border-zinc-100 ${isToday(day) ? "bg-[var(--mitmed-sky)]/[0.04]" : ""}`}
                style={{ height: totalHeight }}
              >
                {hours.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-zinc-100" style={{ top: i * HOUR_PX }} />
                ))}
                <div
                  className="absolute left-0 right-0 flex items-center justify-center bg-zinc-100/70 text-[11px] font-medium text-zinc-400"
                  style={{ top: (LUNCH_BREAK_HOUR - DAY_START_HOUR) * HOUR_PX, height: HOUR_PX }}
                  aria-label="Pauză 13:00–14:00"
                >
                  Pauză
                </div>
                <CalendarNowLine day={day} dayStartHour={DAY_START_HOUR} dayEndHour={DAY_END_HOUR} hourPx={HOUR_PX} />

                {dayAppointments.map((a) => {
                  const start = new Date(a.startsAt);
                  const minutesFromStart = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
                  const top = Math.max(0, (minutesFromStart / 60) * HOUR_PX);
                  const height = Math.max(24, (a.durationMinutes / 60) * HOUR_PX - 3);
                  const endsAt = new Date(start.getTime() + a.durationMinutes * 60_000);
                  const color = colorForTherapy(a.therapyId);
                  const cancelled = a.status === "ANULATA";
                  const finalized = a.status === "FINALIZATA";
                  // Programările încă neefectuate duc direct la Consult — cel mai
                  // rapid drum de la calendar la notițe, în timpul unei ședințe.
                  // Cele deja finalizate/anulate duc la fișa completă, ca dosar.
                  const href =
                    !cancelled && !finalized ? `/admin/consult/${a.id}` : `/admin/clienti/${a.clientId}`;

                  return (
                    <div
                      key={a.id}
                      className={`group absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] shadow-sm transition-all hover:z-10 hover:shadow-md ${color.bg} ${color.border} ${cancelled ? "opacity-40 line-through" : ""}`}
                      style={{ top, height }}
                    >
                      <Link
                        href={href}
                        title={`Programată pe ${formatBooking(a.bookedAt, a.bookedByClient)}`}
                        className={`block h-full px-2 py-1 text-[11px] leading-tight ${color.text}`}
                      >
                        <div className="truncate font-semibold">{new Date(a.startsAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}–{endsAt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="truncate font-semibold">{a.clientName}</div>
                        <div className="truncate opacity-80">{a.therapyName}</div>
                      </Link>
                      {!cancelled && !finalized && (
                        <Link
                          href={`/admin/clienti/${a.clientId}`}
                          className="absolute right-1 top-1 hidden rounded bg-white/70 px-1 text-[10px] font-medium text-zinc-600 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:block"
                        >
                          fișă
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
