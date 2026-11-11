import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, History, RotateCcw, Stethoscope } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { listWeekdayHours, listVacations } from "@/actions/clinic";
import { PayOnlineButton } from "@/components/PayOnlineButton";
import { ClinicLocationCard } from "@/components/ClinicLocationCard";
import { BookingForm } from "../BookingForm";
import { CancelOwnAppointmentButton } from "../CancelOwnAppointmentButton";
import { AddToCalendarButton } from "../_components/AddToCalendarButton";
import { PortalPageHeader } from "../_components/PortalPageHeader";
import { clinicLocalStamp, formatDate, formatTime, relativeDay } from "@/lib/clinicTime";
import { upcomingAppointments } from "../portalData";

type Appointment = { id: string; starts_at: string; status: string; therapy_id: string; therapy: { name: string } };
type Payment = { id: string; status: string; appointment_id: string | null };

const PAST_LABEL: Record<string, { text: string; tone: string }> = {
  FINALIZATA: { text: "Efectuată", tone: "paid" },
  ANULATA: { text: "Anulată", tone: "unpaid" },
};

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ terapie?: string }> }) {
  const [{ terapie }, raw, therapies, hours, vacations] = await Promise.all([
    searchParams,
    getOwnClientData(),
    listTherapies(),
    listWeekdayHours(),
    listVacations(),
  ]);
  await connection();
  const client = raw as { appointments: Appointment[]; payments: Payment[] };
  const now = new Date().getTime();
  const upcoming = upcomingAppointments(client.appointments, now);
  const past = client.appointments
    .filter((a) => new Date(a.starts_at).getTime() < now)
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
    .slice(0, 12);
  const unpaidByAppointment = new Map(
    client.payments.filter((p) => p.appointment_id && p.status !== "PLATIT").map((p) => [p.appointment_id as string, p.id])
  );
  const bookable = therapies.filter((t) => t.active);
  const bookableIds = new Set(bookable.map((t) => t.id));
  const durationOf = (id: string) => therapies.find((t) => t.id === id)?.duration_minutes ?? 60;
  const isConsultationOnly = bookable.length > 0 && bookable.every((t) => t.is_consultation);

  return (
    <div className="portal-subpage">
      <PortalPageHeader title="Programări" />

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <CalendarDays />
          <h2>Programările tale</h2>
        </div>
        {upcoming.length ? (
          <ul className="portal-visit-list">
            {upcoming.map((item) => {
              const unpaidPaymentId = unpaidByAppointment.get(item.id);
              return (
                <li key={item.id}>
                  <div className="portal-visit-main">
                    <strong>
                      {relativeDay(item.starts_at)}, ora {formatTime(item.starts_at)}
                    </strong>
                    <span>
                      {item.therapy.name} · {formatDate(item.starts_at)}
                    </span>
                  </div>
                  <div className="portal-visit-actions">
                    {unpaidPaymentId && <PayOnlineButton paymentId={unpaidPaymentId} className="portal-primary-btn portal-btn-sm" />}
                    <AddToCalendarButton
                      title={item.therapy.name}
                      localStart={clinicLocalStamp(item.starts_at)}
                      durationMinutes={durationOf(item.therapy_id)}
                      className="portal-secondary-btn portal-btn-sm"
                    />
                    <CancelOwnAppointmentButton appointmentId={item.id} startsAt={item.starts_at} variant="default" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="portal-quiet">Nu ai nicio programare viitoare.{bookable.length ? " Fă una mai jos." : ""}</p>
        )}
      </section>

      <section className="portal-feature-panel scroll-mt-24" id="programeaza">
        <div className="portal-panel-title">
          <CalendarDays />
          <h2>Programare nouă</h2>
        </div>
        {isConsultationOnly && (
          <div className="portal-info-note">
            <Stethoscope size={20} />
            <p>
              <strong>Prima programare este o consultație.</strong> După ce te vede medicul, îți deblochează terapiile
              potrivite pentru tine.
            </p>
          </div>
        )}
        <BookingForm
          key={terapie ?? "new"}
          therapies={bookable.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            durationMinutes: item.duration_minutes,
          }))}
          hours={hours}
          vacations={vacations}
          initialTherapyId={terapie}
        />
      </section>

      {past.length > 0 && (
        <section className="portal-feature-panel">
          <div className="portal-panel-title">
            <History />
            <h2>Vizite anterioare</h2>
          </div>
          <ul className="portal-visit-list">
            {past.map((item) => {
              // A past visit not yet closed by the clinic gets no badge — "Programată" would confuse.
              const label = PAST_LABEL[item.status];
              return (
                <li key={item.id}>
                  <div className="portal-visit-main">
                    <strong>{item.therapy.name}</strong>
                    <span>
                      {formatDate(item.starts_at)}, ora {formatTime(item.starts_at)}
                    </span>
                  </div>
                  <div className="portal-visit-actions">
                    {label && (
                      <span className="portal-status-badge" data-variant={label.tone}>
                        {label.text}
                      </span>
                    )}
                    {bookableIds.has(item.therapy_id) && (
                      <Link href={`/portal/programari?terapie=${item.therapy_id}#programeaza`} className="portal-secondary-btn portal-btn-sm">
                        <RotateCcw size={15} /> Programează din nou
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ClinicLocationCard />
    </div>
  );
}
