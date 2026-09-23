import { notFound } from "next/navigation";
import { getClientDetail, listClientDocuments } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { listCoupons } from "@/actions/coupons";
import { listPackages } from "@/actions/packages";
import { getClientConsents, listActiveConsentTemplates } from "@/actions/consents";
import Link from "next/link";
import { MedicalRecordForm } from "./MedicalRecordForm";
import { CnpForm } from "./CnpForm";
import { MedicalRecordsPanel } from "./MedicalRecordsPanel";
import { PatientDocumentsPanel } from "./PatientDocumentsPanel";
import { PaymentForm } from "./PaymentForm";
import { AppointmentForm } from "./AppointmentForm";
import { CancelAppointmentButton } from "./CancelAppointmentButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { Badge } from "@/components/ui/Badge";
import { PackageCheck } from "lucide-react";

type PaymentStatus = "NEPLATIT" | "PARTIAL" | "PLATIT";
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { PLATIT: "Achitat", PARTIAL: "Parțial achitat", NEPLATIT: "Neachitat" };
const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, "success" | "warning" | "danger"> = { PLATIT: "success", PARTIAL: "warning", NEPLATIT: "danger" };
function PaymentStatusBadge({ status }: { status: string }) {
  const known = status as PaymentStatus;
  return <Badge variant={PAYMENT_STATUS_VARIANT[known] ?? "neutral"}>{PAYMENT_STATUS_LABEL[known] ?? status}</Badge>;
}

type ClientDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  cnp: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  medical_history: {
    allergies?: string;
    conditions?: string;
    medications?: string;
    previous_injuries?: string;
    notes?: string;
  } | null;
  profile_data: {
    city?: string;
    county?: string;
    occupation?: string;
    preferred_contact?: string;
    referral_source?: string;
    activity_level?: string;
    primary_goal?: string;
  } | null;
  user: { id: string; email: string; status: string };
  medical_records: {
    id: string;
    session_date: string;
    diagnosis: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    notes: string;
    treatment_plan: string | null;
    body_map: { x: number; y: number; label?: string }[] | null;
    therapy: { name: string } | null;
    author: { email: string } | null;
  }[];
  payments: {
    id: string;
    created_at: string;
    base_price: string;
    discount_amount: string;
    final_price: string;
    status: string;
    therapy: { name: string };
    coupon: { code: string } | null;
    package_total_sessions: number | null;
    sessions_used: number;
    package_name: string | null;
    package_purchase_id: string | null;
  }[];
  appointments: {
    id: string;
    starts_at: string;
    status: string;
    therapy_id: string;
    therapy: { name: string };
  }[];
};

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = ["profil", "dosar", "plati", "programari"].includes(tab ?? "") ? tab! : "profil";
  const [clientRaw, therapiesRaw, coupons, packagesRaw, consentTemplates, documents] = await Promise.all([
    getClientDetail(id),
    listTherapies(),
    listCoupons(),
    listPackages(),
    listActiveConsentTemplates(),
    listClientDocuments(id),
  ]);

  if (!clientRaw) notFound();
  const client = clientRaw as unknown as ClientDetail;
  const consents = await getClientConsents(client.id);
  const signedTypes = new Set(consents.map((c) => c.type));

  const activeAppointmentsCount = client.appointments.filter((a) => a.status === "PROGRAMATA").length;

  const therapies = therapiesRaw
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name, price: t.price, duration_minutes: t.duration_minutes }));
  const activePackages = packagesRaw.filter((p) => p.active);
  const tabs = [
    { id: "profil", label: "Profil" }, { id: "dosar", label: "Dosar medical" },
    { id: "plati", label: "Plăți" }, { id: "programari", label: "Programări" },
  ];

  // Plățile provenite dintr-un pachet multi-terapie (același package_purchase_id)
  // se afișează grupate ca "o singură achiziție" cu sub-rânduri per terapie,
  // nu ca intrări separate fără legătură vizuală între ele.
  const singlePayments = client.payments.filter((p) => !p.package_purchase_id);
  const packageGroups = Object.values(
    client.payments
      .filter((p) => p.package_purchase_id)
      .reduce<Record<string, { purchaseId: string; packageName: string; createdAt: string; status: string; total: number; items: typeof client.payments }>>(
        (acc, p) => {
          const key = p.package_purchase_id as string;
          if (!acc[key]) {
            acc[key] = {
              purchaseId: key,
              packageName: p.package_name ?? "Pachet",
              createdAt: p.created_at,
              status: p.status,
              total: 0,
              items: [],
            };
          }
          acc[key].total += Number(p.final_price);
          acc[key].items.push(p);
          return acc;
        },
        {}
      )
  );

  return (
    <div className="space-y-8">
      <nav className="flex overflow-x-auto border-b border-zinc-200" aria-label="Secțiuni client">{tabs.map((item) => <Link key={item.id} href={`/admin/clienti/${client.id}?tab=${item.id}`} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === item.id ? "border-[var(--mitmed-teal)] text-[var(--mitmed-teal-deep)]" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>{item.label}</Link>)}</nav>

      {activeTab === "profil" && <>
      <section className="mm-card p-4">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">{client.full_name}</h1>
          <ResetPasswordButton userId={client.user.id} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-400">Email</dt>
            <dd>{client.user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Telefon</dt>
            <dd>{client.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">CNP</dt>
            <dd className="tabular-nums">{client.cnp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Status cont</dt>
            <dd>{client.user.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Contact urgență</dt>
            <dd>
              {client.emergency_contact_name ?? "—"} {client.emergency_contact_phone ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">Ședințe active</dt>
            <dd className="font-medium text-sky-700">{activeAppointmentsCount}</dd>
          </div>
        </dl>

        {client.medical_history && Object.keys(client.medical_history).length > 0 && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Chestionar medical (completat de client)
            </h2>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
              {client.medical_history.allergies && (
                <div>
                  <dt className="text-zinc-400">Alergii</dt>
                  <dd>{client.medical_history.allergies}</dd>
                </div>
              )}
              {client.medical_history.conditions && (
                <div>
                  <dt className="text-zinc-400">Afecțiuni</dt>
                  <dd>{client.medical_history.conditions}</dd>
                </div>
              )}
              {client.medical_history.medications && (
                <div>
                  <dt className="text-zinc-400">Medicamente</dt>
                  <dd>{client.medical_history.medications}</dd>
                </div>
              )}
              {client.medical_history.previous_injuries && (
                <div>
                  <dt className="text-zinc-400">Leziuni anterioare</dt>
                  <dd>{client.medical_history.previous_injuries}</dd>
                </div>
              )}
              {client.medical_history.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-zinc-400">Alte note</dt>
                  <dd>{client.medical_history.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {client.profile_data && Object.keys(client.profile_data).length > 0 && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Profil și preferințe</h2>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
              {client.birth_date && <ProfileDetail label="Data nașterii" value={new Date(client.birth_date).toLocaleDateString("ro-RO")} />}
              <ProfileDetail label="Localitate" value={[client.profile_data.city, client.profile_data.county].filter(Boolean).join(", ")} />
              <ProfileDetail label="Ocupație" value={client.profile_data.occupation} />
              <ProfileDetail label="Contact preferat" value={client.profile_data.preferred_contact} />
              <ProfileDetail label="Sursă" value={client.profile_data.referral_source} />
              <ProfileDetail label="Activitate" value={client.profile_data.activity_level} />
              <ProfileDetail label="Obiectiv" value={client.profile_data.primary_goal} />
            </dl>
          </div>
        )}
      </section>

      <section className="mm-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Declarații semnate</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {consentTemplates.map((t) => {
            const signed = signedTypes.has(t.type);
            return (
              <Badge key={t.type} variant={signed ? "success" : "neutral"}>
                {signed ? "✓" : "—"} {t.label}
              </Badge>
            );
          })}
        </div>
      </section>
      </>}

      {activeTab === "dosar" && <section>
        <h2 className="text-base font-semibold text-zinc-900">Fișă medicală</h2>
        <CnpForm clientId={client.id} cnp={client.cnp} />
        <div className="mt-3">
          <MedicalRecordsPanel records={client.medical_records} />
        </div>
        <MedicalRecordForm clientId={client.id} therapies={therapies} />

        <h2 className="mt-8 text-base font-semibold text-zinc-900">Documente</h2>
        <PatientDocumentsPanel clientId={client.id} documents={documents} />
      </section>}

      {activeTab === "plati" && <section>
        <h2 className="text-base font-semibold text-zinc-900">Plăți</h2>

        {packageGroups.length > 0 && (
          <div className="mt-3 space-y-2">
            {packageGroups.map((g) => (
              <div key={g.purchaseId} className="mm-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-zinc-900">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mitmed-sky)]/15 text-[var(--mitmed-teal)]"><PackageCheck size={15} /></span>
                    Pachet: {g.packageName} <PaymentStatusBadge status={g.status} />
                  </span>
                  <span className="text-zinc-500">
                    {new Date(g.createdAt).toLocaleDateString("ro-RO")} · <strong>{g.total.toFixed(2)} RON</strong>
                  </span>
                </div>
                <ul className="mt-2 divide-y divide-zinc-100 text-sm text-zinc-600">
                  {g.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-1.5">
                      <span>{i.therapy.name}</span>
                      <span className="mm-numeric">
                        {i.sessions_used}/{i.package_total_sessions} folosite
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 overflow-hidden mm-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Terapie</th>
                  <th className="px-4 py-2.5">Preț</th>
                  <th className="px-4 py-2.5">Reducere</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Pachet</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {singlePayments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-2 text-zinc-600">{new Date(p.created_at).toLocaleDateString("ro-RO")}</td>
                    <td className="px-4 py-2">{p.therapy.name}</td>
                    <td className="px-4 py-2">{p.base_price} RON</td>
                    <td className="px-4 py-2">
                      {p.discount_amount !== "0" && p.discount_amount !== "0.00" ? `-${p.discount_amount} RON` : "—"}
                      {p.coupon ? ` (${p.coupon.code})` : ""}
                    </td>
                    <td className="px-4 py-2.5">{p.final_price} RON</td>
                    <td className="px-4 py-2 text-zinc-600">
                      {p.package_total_sessions
                        ? `${p.sessions_used}/${p.package_total_sessions} folosite`
                        : "—"}
                    </td>
                    <td className="px-4 py-2"><PaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {singlePayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                      Nicio plată individuală încă.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <PaymentForm clientId={client.id} therapies={therapies} coupons={coupons} packages={activePackages} />
      </section>}

      {activeTab === "programari" && <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Programări</h2>
          <span className="text-sm text-zinc-500">
            <strong className="text-sky-700">{activeAppointmentsCount}</strong> ședințe active
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {client.appointments.map((a) => (
            <div key={a.id} className="mm-card px-4 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {new Date(a.starts_at).toLocaleString("ro-RO")} · {a.therapy.name} · {a.status}
                </span>
                {a.status === "PROGRAMATA" && (
                  <span className="flex items-center gap-3">
                    <Link href={`/admin/consult/${a.id}`} className="text-sm text-sky-600 hover:underline">
                      Deschide consult
                    </Link>
                    <CancelAppointmentButton appointmentId={a.id} clientId={client.id} startsAt={a.starts_at} />
                  </span>
                )}
              </div>
            </div>
          ))}
          {client.appointments.length === 0 && <p className="text-sm text-zinc-400">Nicio programare încă.</p>}
        </div>
        <AppointmentForm clientId={client.id} therapies={therapies} />
      </section>}
    </div>
  );
}

function ProfileDetail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><dt className="text-zinc-400">{label}</dt><dd>{value.replaceAll("_", " ")}</dd></div>;
}

// Randează o secțiune SOAP din fișa de consult doar dacă a fost completată —
// înregistrările mai vechi (dinainte de câmpurile S/O/A) nu au aceste valori.
