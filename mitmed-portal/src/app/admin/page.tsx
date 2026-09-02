import Link from "next/link";
import { listAppointmentsInRange } from "@/actions/appointments";
import { listTherapies } from "@/actions/therapies";
import { getDashboardStats } from "@/actions/clients";
import { listBookingRequests } from "@/actions/publicBookings";
import { WeekCalendar, getWeekRange, type CalendarAppointment } from "@/components/WeekCalendar";
import { TodayAppointments } from "./TodayAppointments";
import { ConsultSavedToast } from "./ConsultSavedToast";
import { IconUsers, IconCalendar, IconPending, IconInbox } from "@/components/icons";

export default async function AdminBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const { start, end } = getWeekRange(week);

  const [appointmentsRaw, therapiesRaw, stats, bookingRequests] = await Promise.all([
    listAppointmentsInRange(start, end),
    listTherapies(),
    getDashboardStats(),
    listBookingRequests(),
  ]);
  const newBookingRequests = bookingRequests.filter((r) => r.status === "NOU").length;

  const therapyOrder = therapiesRaw.map((t) => t.id);

  const appointments: CalendarAppointment[] = appointmentsRaw.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    clientName: a.client_name,
    therapyId: a.therapy_id,
    therapyName: a.therapy_name,
    startsAt: a.starts_at,
    durationMinutes: a.duration_minutes,
    status: a.status,
  }));

  const activeTherapies = therapiesRaw.filter((t) => appointments.some((a) => a.therapyId === t.id));

  const tiles = [
    {
      href: "/admin/clienti",
      icon: IconUsers,
      value: stats.active_clients,
      label: "Clienți activi",
      tone: "sky" as const,
    },
    {
      href: undefined,
      icon: IconCalendar,
      value: stats.active_appointments,
      label: "Ședințe active",
      tone: "teal" as const,
    },
    {
      href: "/admin/clienti",
      icon: IconPending,
      value: stats.pending,
      label: "Conturi în așteptare",
      tone: stats.pending > 0 ? ("amber" as const) : ("neutral" as const),
    },
    {
      href: "/admin/cereri",
      icon: IconInbox,
      value: newBookingRequests,
      label: "Cereri de programare noi",
      tone: newBookingRequests > 0 ? ("violet" as const) : ("neutral" as const),
    },
  ];

  const toneClasses: Record<string, { badge: string; icon: string; value: string }> = {
    sky: { badge: "bg-[var(--mitmed-sky)]/15", icon: "text-[var(--mitmed-teal)]", value: "text-zinc-900" },
    teal: { badge: "bg-[var(--mitmed-teal)]/12", icon: "text-[var(--mitmed-teal)]", value: "text-[var(--mitmed-teal)]" },
    amber: { badge: "bg-amber-100", icon: "text-amber-600", value: "text-amber-700" },
    violet: { badge: "bg-violet-100", icon: "text-violet-600", value: "text-zinc-900" },
    neutral: { badge: "bg-zinc-100", icon: "text-zinc-400", value: "text-zinc-900" },
  };

  return (
    <div className="space-y-7">
      <ConsultSavedToast />

      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Bord</h1>
        <p className="text-sm text-zinc-500">Programările săptămânii, dintr-o privire.</p>
      </div>

      <TodayAppointments appointments={appointments} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const tone = toneClasses[tile.tone];
          const Icon = tile.icon;
          const content = (
            <>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tone.badge}`}>
                <Icon className={`h-[18px] w-[18px] ${tone.icon}`} />
              </span>
              <div className={`mm-numeric mt-3 text-2xl font-bold tracking-tight ${tone.value}`}>{tile.value}</div>
              <div className="text-sm text-zinc-500">{tile.label}</div>
            </>
          );

          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="mm-card p-4 transition-shadow hover:shadow-md">
              {content}
            </Link>
          ) : (
            <div key={tile.label} className="mm-card p-4">
              {content}
            </div>
          );
        })}
      </div>

      <WeekCalendar weekStart={start} appointments={appointments} therapyOrder={therapyOrder} />

      {activeTherapies.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          {activeTherapies.map((t) => {
            const idx = therapyOrder.indexOf(t.id);
            return (
              <span key={t.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: [
                      "var(--mitmed-sky)",
                      "var(--mitmed-teal)",
                      "var(--mitmed-orange)",
                      "#a78bfa",
                      "#fb7185",
                      "#34d399",
                    ][idx % 6],
                  }}
                />
                {t.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
