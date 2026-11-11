import Link from "next/link";
import { CalendarCheck, CalendarX, UserPlus } from "lucide-react";
import { listAppointmentsInRange, listRecentBookings, listRecentClientCancellations } from "@/actions/appointments";
import { listTherapies } from "@/actions/therapies";
import { getDashboardStats } from "@/actions/clients";
import { getInsightsReport } from "@/actions/insights";
import { TherapyLegend, WeekCalendar, getWeekRange, type CalendarAppointment } from "@/components/WeekCalendar";
import { AttentionList, AttentionRow } from "@/components/AttentionList";
import { clinicDayKey, formatDateTime, formatTime } from "@/lib/clinicTime";
import { formatRon } from "@/lib/format";
import { CLINIC_TIME_ZONE } from "@/lib/clinic";
import { DaySchedule } from "./DaySchedule";
import { ConsultSavedToast } from "./ConsultSavedToast";

export default async function AdminBoardPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const { start, end } = getWeekRange(week);
  const now = new Date().getTime();
  // Today and tomorrow in clinic time; a wide window, then filtered by clinic day.
  const todayKey = clinicDayKey(new Date(now));
  const tomorrowKey = clinicDayKey(new Date(now + 86_400_000));

  const [weekRaw, nearRaw, therapiesRaw, stats, today, cancellations, recentBookings] = await Promise.all([
    listAppointmentsInRange(start, end),
    listAppointmentsInRange(new Date(now - 86_400_000), new Date(now + 3 * 86_400_000)),
    listTherapies(),
    getDashboardStats(),
    getInsightsReport("day"),
    listRecentClientCancellations(),
    listRecentBookings(),
  ]);

  const visitsOn = (key: string) => nearRaw.filter((a) => clinicDayKey(new Date(a.starts_at)) === key);
  const todays = visitsOn(todayKey);
  const tomorrows = visitsOn(tomorrowKey);
  const todayActive = todays.filter((a) => a.status !== "ANULATA");
  const todayDone = todayActive.filter((a) => a.status === "FINALIZATA").length;
  const nextVisit = todayActive.find(
    (a) => (a.status === "PROGRAMATA" || a.status === "CONFIRMATA") && new Date(a.starts_at).getTime() + a.duration_minutes * 60_000 > now
  );

  const therapyOrder = therapiesRaw.map((t) => t.id);
  const appointments: CalendarAppointment[] = weekRaw.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    clientName: a.client_name,
    therapyId: a.therapy_id,
    therapyName: a.therapy_name,
    startsAt: a.starts_at,
    bookedAt: a.booked_at,
    bookedByClient: a.booked_by_client,
    durationMinutes: a.duration_minutes,
    status: a.status,
  }));
  const activeTherapies = therapiesRaw.filter((t) => appointments.some((a) => a.therapyId === t.id));

  // One feed for "what changed lately": new bookings and client cancellations.
  const activity = [
    ...recentBookings
      .filter((b) => b.status !== "ANULATA")
      .map((b) => ({ key: `b-${b.id}`, at: b.booked_at, kind: "booked" as const, clientId: b.client_id, name: b.client_name, what: b.therapy_name, when: b.starts_at, online: b.booked_by_client })),
    ...cancellations.map((c) => ({ key: `c-${c.appointment_id}`, at: c.cancelled_at, kind: "cancelled" as const, clientId: c.client_id, name: c.client_name, what: c.therapy_name, when: c.starts_at, online: true })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const dateLabel = new Date(now).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: CLINIC_TIME_ZONE });
  const summary = todayActive.length
    ? [
        `${todayActive.length} ${todayActive.length === 1 ? "programare" : "programări"} azi`,
        todayDone ? `${todayDone} gata` : null,
        nextVisit ? `următorul: ${nextVisit.client_name}, la ${formatTime(nextVisit.starts_at)}` : "nu mai urmează nimeni azi",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Nicio programare azi.";

  return (
    <div className="space-y-6">
      <ConsultSavedToast />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 first-letter:uppercase">{dateLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{summary}</h1>
          {today.current.revenue > 0 && (
            <p className="mt-1 text-sm text-zinc-500">
              Încasat azi: <span className="mm-numeric font-semibold text-zinc-800">{formatRon(today.current.revenue, 0)}</span>
            </p>
          )}
        </div>
        <Link href="/admin/clienti?nou=1" className="mm-btn" data-variant="secondary">
          <UserPlus size={16} /> Client nou
        </Link>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]">
        <div className="space-y-4">
          <DaySchedule title="Azi" visits={todays} now={now} isToday empty="Nicio programare azi." />
          <DaySchedule
            title="Mâine"
            visits={tomorrows}
            now={now}
            isToday={false}
            empty="Nicio programare mâine."
          />
        </div>

        <div className="space-y-4">
          <AttentionList
            attention={today.attention}
            columns={1}
            extra={
              stats.pending > 0
                ? [
                    {
                      key: "pending",
                      node: (
                        <Link
                          href="/admin/clienti"
                          className="group flex h-full w-full items-start gap-3 rounded-[var(--mm-radius-md)] border border-[var(--mm-border)] px-3 py-3 hover:bg-zinc-50"
                        >
                          <AttentionRow
                            severity="high"
                            count={stats.pending}
                            text={stats.pending === 1 ? "Cont nou de aprobat" : "Conturi noi de aprobat"}
                            detail="Clienți care și-au făcut cont și așteaptă aprobarea."
                          />
                        </Link>
                      ),
                    },
                  ]
                : []
            }
          />

          <section className="mm-card p-5">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Ce s-a schimbat în ultimele 7 zile</h2>
            {activity.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Nicio programare nouă sau anulare.</p>
            ) : (
              <ul className="mt-2 max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                {activity.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5 py-2 text-sm">
                    {item.kind === "booked" ? (
                      <CalendarCheck size={16} className="mt-0.5 shrink-0 text-[var(--mitmed-teal)]" aria-label="Programare nouă" />
                    ) : (
                      <CalendarX size={16} className="mt-0.5 shrink-0 text-[var(--mm-danger)]" aria-label="Anulare" />
                    )}
                    <span className="min-w-0">
                      <Link href={`/admin/clienti/${item.clientId}?tab=programari`} className="font-medium text-zinc-900 hover:underline">
                        {item.name}
                      </Link>{" "}
                      <span className="text-zinc-600">
                        {item.kind === "booked" ? (item.online ? "s-a programat online" : "a fost programat") : "a anulat"} · {item.what},{" "}
                        {formatDateTime(item.when)}
                      </span>
                      <span className="block text-xs text-zinc-400">{formatDateTime(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <WeekCalendar weekStart={start} appointments={appointments} therapyOrder={therapyOrder} />

      <TherapyLegend therapies={activeTherapies} therapyOrder={therapyOrder} />
    </div>
  );
}
