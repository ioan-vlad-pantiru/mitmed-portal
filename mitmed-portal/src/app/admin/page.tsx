import Link from "next/link";
import { listAppointmentsInRange, listRecentBookings, listRecentClientCancellations } from "@/actions/appointments";
import { CLINIC_TIME_ZONE, formatBooking } from "@/lib/clinic";
import { listTherapies } from "@/actions/therapies";
import { getDashboardStats } from "@/actions/clients";
import { listBookingRequests } from "@/actions/publicBookings";
import { WeekCalendar, getWeekRange, type CalendarAppointment } from "@/components/WeekCalendar";
import { TodayAppointments } from "./TodayAppointments";
import { ConsultSavedToast } from "./ConsultSavedToast";
import { IconUsers, IconCalendar, IconPending, IconInbox, IconAlert } from "@/components/icons";

export default async function AdminBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const { start, end } = getWeekRange(week);

  const [appointmentsRaw, therapiesRaw, stats, bookingRequests, cancellations, recentBookings] = await Promise.all([
    listAppointmentsInRange(start, end),
    listTherapies(),
    getDashboardStats(),
    listBookingRequests(),
    listRecentClientCancellations(),
    listRecentBookings(),
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
    bookedAt: a.booked_at,
    bookedByClient: a.booked_by_client,
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

      {cancellations.length > 0 && (
        <section className="mm-card border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2">
            <IconAlert className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-zinc-900">Anulate de clienți în ultimele 7 zile</h2>
          </div>
          <ul className="mt-2 divide-y divide-amber-100 text-sm">
            {cancellations.map((c) => (
              <li key={c.appointment_id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <Link href={`/admin/clienti/${c.client_id}?tab=programari`} className="font-medium text-zinc-900 hover:underline">
                    {c.client_name}
                  </Link>{" "}
                  <span className="text-zinc-600">
                    · {c.therapy_name} ·{" "}
                    {new Date(c.starts_at).toLocaleString("ro-RO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {c.client_phone && <a href={`tel:${c.client_phone}`} className="ml-2 text-sky-600 hover:underline">{c.client_phone}</a>}
                </span>
                <span className="text-xs text-zinc-500">
                  anulat {new Date(c.cancelled_at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentBookings.length > 0 && (
        <section className="mm-card p-4">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-[var(--mitmed-teal)]" />
            <h2 className="text-sm font-semibold text-zinc-900">Programări noi în ultimele 7 zile</h2>
          </div>
          <ul className="mt-2 max-h-72 divide-y divide-zinc-100 overflow-y-auto text-sm">
            {recentBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className={b.status === "ANULATA" ? "text-zinc-400 line-through" : undefined}>
                  <Link href={`/admin/clienti/${b.client_id}?tab=programari`} className="font-medium text-zinc-900 hover:underline">
                    {b.client_name}
                  </Link>{" "}
                  <span className="text-zinc-600">
                    · {b.therapy_name} ·{" "}
                    {new Date(b.starts_at).toLocaleString("ro-RO", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: CLINIC_TIME_ZONE,
                    })}
                  </span>
                </span>
                <span className="text-xs text-zinc-500">programată {formatBooking(b.booked_at, b.booked_by_client)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
