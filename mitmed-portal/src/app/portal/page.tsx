import { notFound } from "next/navigation";
import { getOwnClientData } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { getOwnConsents, getCurrentConsentText } from "@/actions/consents";
import { getPublicConfig } from "@/actions/config";
import { BookingForm } from "./BookingForm";
import { MedicalHistoryForm } from "./MedicalHistoryForm";
import { ConsentForm } from "./ConsentForm";

type OwnClientData = {
  full_name: string;
  medical_history: {
    allergies?: string;
    conditions?: string;
    medications?: string;
    previous_injuries?: string;
    notes?: string;
  } | null;
  medical_records: { id: string; session_date: string; notes: string; therapy: { name: string } | null }[];
  payments: { id: string; created_at: string; final_price: string; status: string; therapy: { name: string } }[];
  appointments: { id: string; starts_at: string; status: string; therapy: { name: string } }[];
};

const CONSENT_LABELS: { type: "GDPR" | "RISC_PRET"; title: string }[] = [
  { type: "GDPR", title: "Acord GDPR — prelucrarea datelor medicale" },
  { type: "RISC_PRET", title: "Declarație riscuri tratament și politică de preț" },
];

export default async function PortalPage() {
  const [clientRaw, therapiesRaw, consents, publicConfig] = await Promise.all([
    getOwnClientData(),
    listTherapies(),
    getOwnConsents(),
    getPublicConfig(),
  ]);
  if (!clientRaw) notFound();

  const signedTypes = new Set(consents.map((c) => c.type));
  const unsigned = CONSENT_LABELS.filter((c) => !signedTypes.has(c.type));
  const unsignedTexts = await Promise.all(unsigned.map((c) => getCurrentConsentText(c.type)));
  const client = clientRaw as unknown as OwnClientData;

  const therapies = therapiesRaw
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      durationMinutes: t.duration_minutes,
      sessionsIncluded: t.sessions_included,
    }));

  const hasHadSession = client.medical_records.length > 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-semibold text-zinc-900">Bună, {client.full_name}!</h1>
        <p className="text-sm text-zinc-500">Aici îți poți vedea fișa și programările.</p>
      </section>

      {unsigned.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-base font-semibold text-zinc-900">Declarații de semnat</h2>
          {unsigned.map((c, i) => (
            <ConsentForm
              key={c.type}
              type={c.type}
              title={c.title}
              consentText={unsignedTexts[i]}
              clientName={client.full_name}
            />
          ))}
        </section>
      )}

      {consents.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-zinc-900">Declarații semnate</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {consents.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
                  ✓
                </span>
                {CONSENT_LABELS.find((l) => l.type === c.type)?.title ?? c.type} — semnat pe{" "}
                {new Date(c.signed_at).toLocaleDateString("ro-RO")}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Chestionar medical</h2>
        <MedicalHistoryForm initial={client.medical_history} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Programează o ședință nouă</h2>
        <BookingForm therapies={therapies} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Programările mele</h2>
        <div className="mt-3 space-y-2">
          {client.appointments.map((a) => (
            <div key={a.id} className="mm-card px-4 py-2 text-sm">
              {new Date(a.starts_at).toLocaleString("ro-RO")} · {a.therapy.name} · {a.status}
            </div>
          ))}
          {client.appointments.length === 0 && <p className="text-sm text-zinc-400">Nicio programare încă.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Istoric ședințe</h2>
        <div className="mt-3 space-y-3">
          {client.medical_records.map((r) => (
            <div key={r.id} className="mm-card p-4 text-sm">
              <div className="text-zinc-500">
                {new Date(r.session_date).toLocaleString("ro-RO")} · {r.therapy?.name ?? "—"}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{r.notes}</p>
            </div>
          ))}
          {client.medical_records.length === 0 && <p className="text-sm text-zinc-400">Nicio intrare încă.</p>}
        </div>
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
