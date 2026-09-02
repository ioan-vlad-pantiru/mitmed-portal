import { notFound } from "next/navigation";
import { getOwnClientData } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { getPublicConfig } from "@/actions/config";
import { BookingForm } from "./BookingForm";
import { MedicalHistoryForm } from "./MedicalHistoryForm";
import { ConsentForm } from "./ConsentForm";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/Badge";
import { CancelOwnAppointmentButton } from "./CancelOwnAppointmentButton";

type OwnClientData = {
  full_name: string;
  medical_history: {
    allergies?: string;
    conditions?: string;
    medications?: string;
    previous_injuries?: string;
    notes?: string;
  } | null;
  medical_records: {
    id: string;
    session_date: string;
    diagnosis: string | null;
    treatment_plan: string | null;
    notes: string;
    therapy: { name: string } | null;
  }[];
  payments: {
    id: string;
    created_at: string;
    final_price: string;
    status: string;
    therapy: { name: string };
    package_total_sessions: number | null;
    sessions_used: number;
  }[];
  appointments: { id: string; starts_at: string; status: string; therapy: { name: string } }[];
};

const ACTIVE_STATUSES = new Set(["PROGRAMATA", "CONFIRMATA"]);

function daysUntilLabel(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days === 0) return "Astăzi";
  if (days === 1) return "Mâine";
  if (days > 1 && days <= 6) return `Peste ${days} zile`;
  return date.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

export default async function PortalPage() {
  const [clientRaw, therapiesRaw, consents, templates, publicConfig] = await Promise.all([
    getOwnClientData(),
    listTherapies(),
    getOwnConsents(),
    listActiveConsentTemplates(),
    getPublicConfig(),
  ]);
  if (!clientRaw) notFound();

  const signedTypes = new Set(consents.map((c) => c.type));
  const unsigned = templates.filter((t) => !signedTypes.has(t.type));
  const client = clientRaw as unknown as OwnClientData;

  const therapies = therapiesRaw
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      durationMinutes: t.duration_minutes,
    }));

  const hasHadSession = client.medical_records.length > 0;

  // Programările viitoare, în ordine — prima e "hero"-ul paginii, restul
  // (rar mai mult de una) apar într-o listă compactă sub ea.
  // Date.now() e sigur aici — e o Server Component, randată din nou la
  // fiecare request, nu un component client memoizat de compilator; regula
  // de puritate vizează cazul din urmă.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = client.appointments
    .filter((a) => ACTIVE_STATUSES.has(a.status) && new Date(a.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const nextAppointment = upcoming[0];
  const restUpcoming = upcoming.slice(1);

  // Pachete cu ședințe încă nefolosite — ce contează practic pentru client:
  // "câte ședințe mai am".
  const activePackages = client.payments.filter(
    (p) => p.package_total_sessions !== null && p.sessions_used < p.package_total_sessions
  );

  // Istoricul, cel mai recent primul.
  const history = [...client.medical_records].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-3">
        <Logo size={36} />
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Bună, {client.full_name}!</h1>
          <p className="text-sm text-zinc-500">Programările și istoricul tău, dintr-o privire.</p>
        </div>
      </section>

      {unsigned.length > 0 && (
        <a
          href="#declaratii"
          className="mm-card flex items-center justify-between gap-3 border-l-4 border-l-amber-400 p-4 text-sm transition-shadow hover:shadow-md"
        >
          <span className="text-zinc-700">
            Ai <strong>{unsigned.length}</strong> {unsigned.length === 1 ? "declarație" : "declarații"} de semnat
            înainte de următoarea ședință.
          </span>
          <span className="shrink-0 font-medium text-[var(--mitmed-teal)]">Semnează acum ↓</span>
        </a>
      )}

      {/* Hero — următoarea programare. E primul lucru la care se uită clientul. */}
      <section>
        {nextAppointment ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-[var(--mitmed-teal)] to-[var(--mitmed-teal-deep)] p-6 text-[var(--mitmed-mist)] shadow-[0_1px_2px_rgba(16,24,24,0.04),0_16px_40px_-20px_rgba(0,63,64,0.5)] sm:p-7">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--mitmed-sky)]">
              Următoarea ta programare
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {daysUntilLabel(new Date(nextAppointment.starts_at))}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[var(--mitmed-mist)]/85">
                {new Date(nextAppointment.starts_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}{" "}
                · {nextAppointment.therapy.name}
              </p>
              <CancelOwnAppointmentButton appointmentId={nextAppointment.id} startsAt={nextAppointment.starts_at} />
            </div>
          </div>
        ) : (
          <div className="mm-card p-6 text-center">
            <p className="text-zinc-700">Nu ai nicio programare viitoare.</p>
            <p className="mt-1 text-sm text-zinc-500">Programează o ședință mai jos, când ești pregătit/ă.</p>
          </div>
        )}

        {restUpcoming.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {restUpcoming.map((a) => (
              <li key={a.id} className="mm-card flex items-center justify-between gap-2 px-4 py-2 text-sm text-zinc-600">
                <span>
                  {new Date(a.starts_at).toLocaleString("ro-RO")} · {a.therapy.name}
                </span>
                <CancelOwnAppointmentButton appointmentId={a.id} startsAt={a.starts_at} variant="default" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {activePackages.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-zinc-900">Pachete active</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activePackages.map((p) => {
              const total = p.package_total_sessions ?? 1;
              const pct = Math.min(100, (p.sessions_used / total) * 100);
              return (
                <div key={p.id} className="mm-card p-4">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-zinc-800">{p.therapy.name}</span>
                    <span className="mm-numeric text-zinc-500">
                      {p.sessions_used}/{total} folosite
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--mitmed-sky)] to-[var(--mitmed-teal)]"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Programează o ședință nouă</h2>
        <BookingForm therapies={therapies} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Istoric ședințe</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Nicio ședință încă.</p>
        ) : (
          <ol className="relative mt-4 space-y-5 border-l border-zinc-200 pl-5">
            {history.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[var(--mitmed-teal)] shadow" />
                <div className="text-xs text-zinc-400">
                  {new Date(r.session_date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                  {r.therapy?.name && <> · {r.therapy.name}</>}
                </div>
                {r.diagnosis && <p className="mt-1 text-sm font-medium text-zinc-800">{r.diagnosis}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{r.notes}</p>
                {r.treatment_plan && (
                  <p className="mt-2 rounded-md bg-[var(--mm-info-bg)] px-2.5 py-1.5 text-sm text-[var(--mm-info)]">
                    <strong>Plan de tratament:</strong> {r.treatment_plan}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="declaratii" className="scroll-mt-4 space-y-5">
        <h2 className="text-base font-semibold text-zinc-900">Declarații</h2>

        {unsigned.length > 0 && (
          <div className="space-y-5">
            {unsigned.map((t) => (
              <ConsentForm key={t.type} type={t.type} title={t.label} consentText={t.text} clientName={client.full_name} />
            ))}
          </div>
        )}

        {consents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {consents.map((c) => (
              <Badge key={c.id} variant="success">
                ✓ {templates.find((t) => t.type === c.type)?.label ?? c.type} — semnat pe{" "}
                {new Date(c.signed_at).toLocaleDateString("ro-RO")}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Chestionar medical</h2>
        <MedicalHistoryForm initial={client.medical_history} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Plăți</h2>
        <div className="mt-3 space-y-2">
          {client.payments.map((p) => (
            <div key={p.id} className="flex justify-between mm-card px-4 py-2 text-sm">
              <span>
                {new Date(p.created_at).toLocaleDateString("ro-RO")} · {p.therapy.name}
              </span>
              <span className="font-medium">
                {p.final_price} RON · {p.status}
              </span>
            </div>
          ))}
          {client.payments.length === 0 && <p className="text-sm text-zinc-400">Nicio plată încă.</p>}
        </div>
      </section>

      {hasHadSession && publicConfig.google_review_url && (
        <section className="mm-card p-4 text-center">
          <p className="text-sm text-zinc-700">Ai avut o ședință cu noi — ne-ar ajuta enorm o recenzie.</p>
          <a
            href={publicConfig.google_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-md bg-[var(--mitmed-teal)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--mitmed-teal-deep)]"
          >
            Lasă-ne o recenzie pe Google
          </a>
        </section>
      )}
    </div>
  );
}
