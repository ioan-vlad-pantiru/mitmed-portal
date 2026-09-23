import { CalendarDays, Stethoscope } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { listWeekdayHours, listVacations } from "@/actions/clinic";
import { BookingForm } from "../BookingForm";
import { CancelOwnAppointmentButton } from "../CancelOwnAppointmentButton";
import { PayOnlineButton } from "@/components/PayOnlineButton";

type Payment = { id: string; status: string; appointment_id: string | null };

export default async function AppointmentsPage() {
  const [raw, therapies, hours, vacations] = await Promise.all([
    getOwnClientData(),
    listTherapies(),
    listWeekdayHours(),
    listVacations(),
  ]);
  const client = raw as {
    appointments: { id: string; starts_at: string; status: string; therapy: { name: string } }[];
    payments: Payment[];
  };
  const upcoming = client.appointments
    .filter((item) => ["PROGRAMATA", "CONFIRMATA"].includes(item.status) && new Date(item.starts_at) >= new Date())
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const unpaidByAppointment = new Map(
    client.payments.filter((p) => p.appointment_id && p.status !== "PLATIT").map((p) => [p.appointment_id as string, p.id])
  );
  const bookableTherapies = therapies.filter((item) => item.active);
  // La fel ca pe pagina principală a portalului — dacă tot ce poate rezerva
  // clientul e marcat `is_consultation`, n-are încă nimic deblocat de medic.
  const isConsultationOnly = bookableTherapies.length > 0 && bookableTherapies.every((t) => t.is_consultation);

  return (
    <div className="portal-subpage">
      <header>
        <p>Programări</p>
        <h1>Alege timpul potrivit pentru tine.</h1>
        <span>Gestionează ședințele tale și rezervă o nouă vizită.</span>
      </header>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <CalendarDays />
          <h2>Programări viitoare</h2>
        </div>
        {upcoming.length ? (
          <div className="portal-appointment-list">
            {upcoming.map((item) => {
              const unpaidPaymentId = unpaidByAppointment.get(item.id);
              return (
                <div key={item.id}>
                  <div>
                    <strong>
                      {new Date(item.starts_at).toLocaleDateString("ro-RO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </strong>
                    <span>
                      {new Date(item.starts_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {item.therapy.name}
                    </span>
                  </div>
                  <div className="portal-appointment-actions">
                    {unpaidPaymentId && <PayOnlineButton paymentId={unpaidPaymentId} className="portal-pay-btn" />}
                    <CancelOwnAppointmentButton appointmentId={item.id} startsAt={item.starts_at} variant="default" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="portal-quiet">Nu ai nicio programare viitoare.</p>
        )}
      </section>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <CalendarDays />
          <h2>Programează o ședință</h2>
        </div>
        {isConsultationOnly && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--mitmed-sky)]/12 px-3.5 py-3 text-sm text-[var(--mitmed-teal-deep)]">
            <Stethoscope size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong>Prima programare trebuie să fie o consultație.</strong> Restul terapiilor se deblochează abia
              după ce medicul te vede — de-asta apare doar consultația mai jos.
            </p>
          </div>
        )}
        <BookingForm
          therapies={bookableTherapies.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            durationMinutes: item.duration_minutes,
          }))}
          hours={hours}
          vacations={vacations}
        />
      </section>
    </div>
  );
}
