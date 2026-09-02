import Link from "next/link";
import type { CalendarAppointment } from "@/components/WeekCalendar";

/** Listă compactă a programărilor de azi, cu acces direct la ecranul de
 * Consult — gândită pentru "următorul pacient", nu pentru navigare prin listă. */
export function TodayAppointments({ appointments }: { appointments: CalendarAppointment[] }) {
  const today = new Date();
  const todays = appointments
    .filter((a) => {
      const d = new Date(a.startsAt);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate() &&
        a.status !== "ANULATA"
      );
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (todays.length === 0) return null;

  return (
    <section className="mm-card p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Astăzi</h2>
      <ul className="mt-2 divide-y divide-zinc-100">
        {todays.map((a) => {
          const done = a.status === "FINALIZATA";
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="mm-numeric font-medium text-zinc-700">
                    {new Date(a.startsAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate font-medium text-zinc-900">{a.clientName}</span>
                </div>
                <p className="truncate text-xs text-zinc-500">{a.therapyName}</p>
              </div>
              {done ? (
                <span data-variant="success" className="mm-badge shrink-0">
                  ✓ Finalizată
                </span>
              ) : (
                <Link href={`/admin/consult/${a.id}`} className="mm-btn shrink-0" data-variant="primary">
                  Intră în consult
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
