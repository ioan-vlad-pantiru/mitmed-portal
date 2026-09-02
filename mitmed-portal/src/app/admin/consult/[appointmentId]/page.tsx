import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppointmentForConsult, listAppointmentsInRange } from "@/actions/appointments";
import { ConsultForm } from "./ConsultForm";
import { IconClose } from "@/components/icons";

const CONSENT_LABELS: Record<string, string> = {
  GDPR: "Acord GDPR",
  RISC_PRET: "Declarație riscuri + preț",
};

export default async function ConsultPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const data = await getAppointmentForConsult(appointmentId);
  if (!data) notFound();

  const { appointment, client, recent_records, consents, active_package } = data;

  // Programările neefectuate ale zilei, în ordine — permite trecerea la
  // "următorul pacient" din interiorul consultului, fără a reveni la bord.
  const dayStart = new Date(appointment.starts_at);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayAppointments = (await listAppointmentsInRange(dayStart, dayEnd))
    .filter((a) => a.status === "PROGRAMATA" || a.status === "CONFIRMATA")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const currentIdx = dayAppointments.findIndex((a) => a.id === appointment.id);
  const prevAppointmentId = currentIdx > 0 ? dayAppointments[currentIdx - 1].id : null;
  const nextAppointmentId =
    currentIdx >= 0 && currentIdx < dayAppointments.length - 1 ? dayAppointments[currentIdx + 1].id : null;
  const age = client.birth_date
    ? Math.floor(
        (new Date(appointment.starts_at).getTime() - new Date(client.birth_date).getTime()) /
          (365.25 * 24 * 3600 * 1000)
      )
    : null;

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6 sm:h-screen">
      {/* Header fix — informația de context nu ar trebui să ceară niciun scroll. */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200/70 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {dayAppointments.length > 1 && (
            <span className="mm-numeric shrink-0 text-xs text-zinc-400">
              {currentIdx + 1}/{dayAppointments.length} azi
            </span>
          )}
          <div>
            <h1 className="text-base font-semibold text-zinc-900">
              {client.full_name} {age !== null && <span className="font-normal text-zinc-400">· {age} ani</span>}
            </h1>
            <p className="text-sm text-zinc-500">
              {appointment.therapy.name} · {new Date(appointment.starts_at).toLocaleString("ro-RO")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prevAppointmentId && (
            <Link
              href={`/admin/consult/${prevAppointmentId}`}
              aria-label="Pacientul anterior"
              title="Pacientul anterior ([)"
              className="mm-btn"
              data-variant="ghost"
            >
              ← Anterior
            </Link>
          )}
          {nextAppointmentId && (
            <Link
              href={`/admin/consult/${nextAppointmentId}`}
              aria-label="Pacientul următor"
              title="Pacientul următor (])"
              className="mm-btn"
              data-variant="ghost"
            >
              Următor →
            </Link>
          )}
          <Link href={`/admin/clienti/${client.id}`} className="mm-btn" data-variant="secondary">
            Fișă completă
          </Link>
          <Link href="/admin" aria-label="Ieși din consult" className="mm-btn" data-variant="ghost">
            <IconClose className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[300px_1fr] sm:gap-6 sm:overflow-hidden sm:p-6">
        {/* Istoric rapid — read-only, vizibil fără niciun click suplimentar. */}
        <aside className="space-y-4 sm:overflow-y-auto sm:pr-1">
          <section className="mm-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Chestionar medical</h2>
            {client.medical_history && Object.keys(client.medical_history).length > 0 ? (
              <dl className="mt-2 space-y-1.5 text-sm text-zinc-600">
                {client.medical_history.allergies && (
                  <div>
                    <dt className="text-xs text-zinc-400">Alergii</dt>
                    <dd>{client.medical_history.allergies}</dd>
                  </div>
                )}
                {client.medical_history.conditions && (
                  <div>
                    <dt className="text-xs text-zinc-400">Afecțiuni</dt>
                    <dd>{client.medical_history.conditions}</dd>
                  </div>
                )}
                {client.medical_history.medications && (
                  <div>
                    <dt className="text-xs text-zinc-400">Medicamente</dt>
                    <dd>{client.medical_history.medications}</dd>
                  </div>
                )}
                {client.medical_history.previous_injuries && (
                  <div>
                    <dt className="text-xs text-zinc-400">Leziuni anterioare</dt>
                    <dd>{client.medical_history.previous_injuries}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">Necompletat.</p>
            )}
          </section>

          <section className="mm-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Declarații semnate</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["GDPR", "RISC_PRET"] as const).map((type) => {
                const signed = consents.some((c) => c.type === type);
                return (
                  <span key={type} data-variant={signed ? "success" : "neutral"} className="mm-badge">
                    {signed ? "✓" : "—"} {CONSENT_LABELS[type]}
                  </span>
                );
              })}
            </div>
          </section>

          {active_package && (
            <section className="mm-card p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Pachet activ</h2>
              <p className="mt-1 text-sm text-zinc-700">
                <span className="mm-numeric font-semibold text-[var(--mitmed-teal)]">
                  {active_package.sessions_used + 1}/{active_package.package_total_sessions}
                </span>{" "}
                — această ședință va consuma ședința curentă din pachet.
              </p>
            </section>
          )}

          <section className="mm-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Ultimele ședințe</h2>
            {recent_records.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-400">Nicio intrare încă.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {recent_records.map((r) => (
                  <li key={r.id} className="border-t border-zinc-100 pt-2 text-sm first:border-0 first:pt-0">
                    <div className="text-xs text-zinc-400">
                      {new Date(r.session_date).toLocaleDateString("ro-RO")} · {r.therapy_name ?? "—"}
                    </div>
                    {r.diagnosis && <p className="mt-0.5 font-medium text-zinc-700">{r.diagnosis}</p>}
                    <p className="mt-0.5 line-clamp-2 text-zinc-600">{r.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <ConsultForm
          clientId={client.id}
          appointmentId={appointment.id}
          therapyId={appointment.therapy.id}
          prevAppointmentId={prevAppointmentId}
          nextAppointmentId={nextAppointmentId}
        />
      </div>
    </div>
  );
}
