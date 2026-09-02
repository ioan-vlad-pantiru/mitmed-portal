import { notFound } from "next/navigation";
import { getClientDetail } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { listCoupons } from "@/actions/coupons";
import { listPackages } from "@/actions/packages";
import { getClientConsents, listActiveConsentTemplates } from "@/actions/consents";
import Link from "next/link";
import { MedicalRecordForm } from "./MedicalRecordForm";
import { PaymentForm } from "./PaymentForm";
import { AppointmentForm } from "./AppointmentForm";
import { CancelAppointmentButton } from "./CancelAppointmentButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { BodyMapView } from "@/components/BodyMap";
import { Badge } from "@/components/ui/Badge";

type ClientDetail = {
  id: string;
  full_name: string;
  phone: string | null;
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
  user: { id: string; email: string; status: string };
  medical_records: {
    id: string;
    session_date: string;
    diagnosis: string | null;
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

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clientRaw, therapiesRaw, coupons, packagesRaw, consentTemplates] = await Promise.all([
    getClientDetail(id),
    listTherapies(),
    listCoupons(),
    listPackages(),
    listActiveConsentTemplates(),
  ]);

  if (!clientRaw) notFound();
  const client = clientRaw as unknown as ClientDetail;
  const consents = await getClientConsents(client.id);
  const signedTypes = new Set(consents.map((c) => c.type));

  const activeAppointmentsCount = client.appointments.filter((a) => a.status === "PROGRAMATA").length;

  const therapies = therapiesRaw
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name, price: t.price }));
  const activePackages = packagesRaw.filter((p) => p.active);

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
      <section className="mm-card p-4">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">{client.full_name}</h1>
          <ResetPasswordButton userId={client.user.id} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-400">Email</dt>
            <dd>{client.user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Telefon</dt>
            <dd>{client.phone ?? "—"}</dd>
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

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Fișă medicală</h2>
        <div className="mt-3 space-y-3">
          {client.medical_records.map((r) => (
            <div key={r.id} className="mm-card p-4 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>{new Date(r.session_date).toLocaleString("ro-RO")}</span>
                <span>
                  {r.therapy?.name ?? "—"} · scris de {r.author?.email ?? "—"}
                </span>
              </div>
              {r.diagnosis && (
                <p className="mt-2">
                  <strong>Diagnostic:</strong> {r.diagnosis}
                </p>
              )}
              <p className="mt-1 whitespace-pre-wrap">{r.notes}</p>
              {r.treatment_plan && (
                <p className="mt-2 rounded-md bg-[var(--mm-info-bg)] px-2.5 py-1.5 text-[var(--mm-info)]">
                  <strong>Plan de tratament:</strong> {r.treatment_plan}
                </p>
              )}
              {r.body_map && r.body_map.length > 0 && (
                <div className="mt-2">
                  <BodyMapView points={r.body_map} />
                </div>
              )}
            </div>
          ))}
          {client.medical_records.length === 0 && (
            <p className="text-sm text-zinc-400">Nicio intrare încă.</p>
          )}
        </div>
        <MedicalRecordForm clientId={client.id} therapies={therapies} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Plăți</h2>

        {packageGroups.length > 0 && (
          <div className="mt-3 space-y-2">
            {packageGroups.map((g) => (
              <div key={g.purchaseId} className="mm-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-zinc-900">
                    Pachet: {g.packageName} <span className="font-normal text-zinc-400">({g.status})</span>
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
          <table className="w-full text-sm">
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
                  <td className="px-4 py-2">{p.status}</td>
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
        <PaymentForm clientId={client.id} therapies={therapies} coupons={coupons} packages={activePackages} />
      </section>

      <section>
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
      </section>
    </div>
  );
}
