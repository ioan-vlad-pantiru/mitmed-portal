import { notFound } from "next/navigation";
import { getClientDetail, listClientDocuments } from "@/actions/clients";
import { listTherapies } from "@/actions/therapies";
import { listWeekdayHours, listVacations } from "@/actions/clinic";
import { listClientFidelityCards, listFidelityCardTypes } from "@/actions/fidelity";
import { listCoupons } from "@/actions/coupons";
import { listPackages } from "@/actions/packages";
import { getClientConsents, listActiveConsentTemplates } from "@/actions/consents";
import { listConsultationSheetFields, listSheetTemplates } from "@/actions/consultationSheets";
import { TEMPLATE_CONSULTATIE, TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import Link from "next/link";
import { MedicalRecordForm } from "./MedicalRecordForm";
import { PatientDetailsForm } from "./PatientDetailsForm";
import { SheetsPanel, type ConsultationSheet } from "./SheetsPanel";
import { NotesForm } from "./NotesForm";
import { UnlockedTherapiesForm } from "./UnlockedTherapiesForm";
import { FidelityCardsPanel } from "./FidelityCardsPanel";
import { FidelityCardProgress } from "@/components/FidelityProgress";
import { MedicalRecordsPanel } from "./MedicalRecordsPanel";
import { PatientDocumentsPanel } from "./PatientDocumentsPanel";
import { PaymentForm, type PayableBooking } from "./PaymentForm";
import { AppointmentForm } from "./AppointmentForm";
import { CancelAppointmentButton } from "./CancelAppointmentButton";
import { AppointmentAdminControls } from "./AppointmentAdminControls";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { ClientHeader } from "./ClientHeader";
import { EditableProfileCard } from "./EditableProfileCard";
import { Badge } from "@/components/ui/Badge";
import { MarkPaidControl } from "@/components/MarkPaidControl";
import { CorrectPaymentControl } from "@/components/CorrectPaymentControl";
import { DeletePaymentControl } from "@/components/DeletePaymentControl";
import { getCurrentUser } from "@/lib/authSession";
import { formatBooking } from "@/lib/clinic";
import { formatDay, formatTime } from "@/lib/clinicTime";
import { Check, Minus, PackageCheck } from "lucide-react";

type PaymentStatus = "NEPLATIT" | "PARTIAL" | "PLATIT";
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { PLATIT: "Achitat", PARTIAL: "Parțial achitat", NEPLATIT: "Neachitat" };
const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, "success" | "warning" | "danger"> = { PLATIT: "success", PARTIAL: "warning", NEPLATIT: "danger" };
function PaymentStatusBadge({ status }: { status: string }) {
  const known = status as PaymentStatus;
  return <Badge variant={PAYMENT_STATUS_VARIANT[known] ?? "neutral"}>{PAYMENT_STATUS_LABEL[known] ?? status}</Badge>;
}

const APPOINTMENT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" }> = {
  FINALIZATA: { label: "Efectuată", variant: "success" },
  ANULATA: { label: "Anulată", variant: "danger" },
  PROGRAMATA: { label: "Nefinalizată", variant: "warning" },
  CONFIRMATA: { label: "Nefinalizată", variant: "warning" },
};
function AppointmentStatusBadge({ status }: { status: string }) {
  const s = APPOINTMENT_STATUS[status];
  return s ? <Badge variant={s.variant}>{s.label}</Badge> : <Badge>{status}</Badge>;
}

type ClientDetail = {
  id: string;
  full_name: string;
  created_at: string;
  phone: string | null;
  birth_date: string | null;
  cnp: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  unlocked_therapy_ids: string[];
  consultation_sheets: ConsultationSheet[];
  medical_history: {
    allergies?: string;
    conditions?: string;
    medications?: string;
    previous_injuries?: string;
    notes?: string;
  } | null;
  profile_data: {
    gender?: string;
    city?: string;
    county?: string;
    address?: string;
    occupation?: string;
    occupation_category?: string;
    preferred_contact?: string;
    preferred_language?: string;
    referral_source?: string;
    referral_details?: string;
    activity_level?: string;
    primary_goal?: string;
    secondary_goal?: string;
    interest?: string;
    communication_consent?: boolean;
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
    field_values: Record<string, string>;
    therapy: { name: string } | null;
    therapies: { id: string; name: string }[];
    author: { email: string } | null;
  }[];
  payments: {
    id: string;
    created_at: string;
    base_price: string;
    discount_amount: string;
    final_price: string;
    amount_paid: string;
    paid_via_payu: boolean;
    status: string;
    therapy_id: string;
    therapy: { name: string };
    coupon: { code: string } | null;
    appointment_id: string | null;
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
    booked_at: string;
    booked_by_client: boolean;
  }[];
};

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = ["profil", "dosar", "plati", "programari"].includes(tab ?? "") ? tab! : "profil";
  const [clientRaw, therapiesRaw, coupons, packagesRaw, consentTemplates, documents, hours, vacations, fidelityCards, fidelityCardTypes, sheetFields, sheetTemplates] =
    await Promise.all([
      getClientDetail(id),
      listTherapies(),
      listCoupons(),
      listPackages(),
      listActiveConsentTemplates(),
      listClientDocuments(id),
      listWeekdayHours(),
      listVacations(),
      listClientFidelityCards(id),
      listFidelityCardTypes(),
      listConsultationSheetFields(true),
      listSheetTemplates(),
    ]);

  if (!clientRaw) notFound();
  const client = clientRaw as unknown as ClientDetail;
  const isAdmin = (await getCurrentUser())?.role === "ADMIN";
  const consents = await getClientConsents(client.id);
  const signedTypes = new Set(consents.map((c) => c.type));

  const now = new Date().getTime();
  const upcomingAppointments = client.appointments
    .filter((a) => (a.status === "PROGRAMATA" || a.status === "CONFIRMATA") && new Date(a.starts_at).getTime() >= now - 2 * 3600_000)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const pastAppointments = client.appointments.filter((a) => !upcomingAppointments.includes(a));
  const amountOwed = client.payments
    .filter((p) => p.status !== "PLATIT")
    .reduce((sum, p) => sum + Number(p.final_price) - Number(p.amount_paid), 0);
  // Statistici rapide pentru un overview la o privire, în capul tab-ului
  // Profil — nu duplicat de date, doar agregate din ce oricum se încarcă mai
  // jos pentru tab-urile Dosar/Plăți/Programări.
  const lastVisit = client.medical_records[0]?.session_date ?? null; // deja sortate desc
  const unlockedTherapyNames = therapiesRaw
    .filter((t) => client.unlocked_therapy_ids.includes(t.id))
    .map((t) => t.name);
  const hasMedicalHistory = Boolean(client.medical_history && Object.values(client.medical_history).some(Boolean));
  // profile_data devine un obiect (fie și doar cu communication_consent: false)
  // din prima salvare a formularului din portal — non-null înseamnă "a
  // completat formularul măcar o dată", indiferent ce a lăsat necompletat.
  const hasProfileData = client.profile_data != null;

  const therapies = therapiesRaw
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name, price: t.price, duration_minutes: t.duration_minutes }));
  const activePackages = packagesRaw.filter((p) => p.active);
  // Programările clientului cu starea plății fiecăreia — în tab-ul Plăți, ca
  // recepția să le poată bifa direct într-o plată.
  const paymentByAppointment = new Map(
    client.payments.filter((p) => p.appointment_id).map((p) => [p.appointment_id as string, p])
  );
  const packageTherapyIds = new Set(
    client.payments
      .filter((p) => p.package_total_sessions && p.sessions_used < p.package_total_sessions)
      .map((p) => p.therapy_id)
  );
  const payableBookings: PayableBooking[] = client.appointments.map((a) => ({
    id: a.id,
    therapyId: a.therapy_id,
    therapyName: a.therapy.name,
    startsAt: a.starts_at,
    status: a.status,
    paymentStatus: (paymentByAppointment.get(a.id)?.status as PayableBooking["paymentStatus"]) ?? null,
    coveredByPackage: packageTherapyIds.has(a.therapy_id),
  }));
  const activeFidelityCards = fidelityCards.filter((c) => c.active);
  const patientHeader = {
    full_name: client.full_name,
    cnp: client.cnp,
    birth_date: client.birth_date,
    phone: client.phone,
    gender: client.profile_data?.gender,
    address: client.profile_data?.address,
    occupation: client.profile_data?.occupation,
  };
  const fieldsOf = (templateId: string) => sheetFields.filter((f) => f.template_id === templateId);
  const sheetsOf = (templateId: string) => client.consultation_sheets.filter((s) => s.template_id === templateId);
  const consultationTemplate = sheetTemplates.find((t) => t.id === TEMPLATE_CONSULTATIE);
  const treatmentTemplate = sheetTemplates.find((t) => t.id === TEMPLATE_TRATAMENT);
  const customTemplates = sheetTemplates.filter((t) => t.kind === "custom");
  const treatmentFields = fieldsOf(TEMPLATE_TRATAMENT);
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
      .reduce<
        Record<
          string,
          { purchaseId: string; packageName: string; createdAt: string; total: number; totalPaid: number; items: typeof client.payments }
        >
      >((acc, p) => {
        const key = p.package_purchase_id as string;
        if (!acc[key]) {
          acc[key] = { purchaseId: key, packageName: p.package_name ?? "Pachet", createdAt: p.created_at, total: 0, totalPaid: 0, items: [] };
        }
        acc[key].total += Number(p.final_price);
        acc[key].totalPaid += Number(p.amount_paid);
        acc[key].items.push(p);
        return acc;
      }, {})
  ).map((g) => ({
    ...g,
    // Derivat din sumele reale, nu din statusul ultimei linii — o achiziție
    // cu terapii plătite diferit (ex. una integral, alta parțial) tot trebuie
    // să apară corect ca parțial achitată, nu ca oricare status a "câștigat" ultimul.
    status: g.totalPaid <= 0 ? "NEPLATIT" : g.totalPaid >= g.total ? "PLATIT" : "PARTIAL",
    remaining: g.total - g.totalPaid,
    paidViaPayu: g.items.some((i) => i.paid_via_payu),
  }));

  return (
    <div className="space-y-6">
      <ClientHeader
        clientId={client.id}
        fullName={client.full_name}
        birthDate={client.birth_date}
        createdAt={client.created_at}
        phone={client.phone}
        email={client.user.email}
        medicalHistory={client.medical_history}
        appointments={client.appointments}
        amountOwed={amountOwed}
        unsignedDocuments={consentTemplates.filter((t) => !signedTypes.has(t.type)).length}
        lastVisit={lastVisit}
        sessionsDone={client.appointments.filter((a) => a.status === "FINALIZATA").length}
      />
      <nav className="flex overflow-x-auto border-b border-zinc-200" aria-label="Secțiuni client">{tabs.map((item) => <Link key={item.id} href={`/admin/clienti/${client.id}?tab=${item.id}`} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === item.id ? "border-[var(--mitmed-teal)] text-[var(--mitmed-teal-deep)]" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>{item.label}</Link>)}</nav>

      {activeTab === "profil" && <>
      <EditableProfileCard
        client={{ ...client, email: client.user.email }}
        header={<h2 className="text-base font-semibold text-zinc-900">Date personale</h2>}
        actions={<ResetPasswordButton userId={client.user.id} />}
      >

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 break-words text-sm text-zinc-600 sm:grid-cols-4">
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
            <dt className="text-zinc-400">Data nașterii</dt>
            <dd>{client.birth_date ? new Date(client.birth_date).toLocaleDateString("ro-RO") : "—"}</dd>
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
            <dt className="text-zinc-400">Documente</dt>
            <dd>{documents.length}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Declarații semnate</dt>
            <dd>{signedTypes.size}/{consentTemplates.length}</dd>
          </div>
        </dl>

        {unlockedTherapyNames.length > 0 && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Terapii deblocate</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unlockedTherapyNames.map((name) => (
                <Badge key={name} variant="success">{name}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Chestionar medical (completat de client)
            </h2>
            {!hasMedicalHistory && <Badge variant="neutral">Necompletat de client</Badge>}
          </div>
          {hasMedicalHistory && <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 break-words text-sm text-zinc-600 sm:grid-cols-4">
            <ProfileDetail label="Alergii" value={client.medical_history?.allergies} />
            <ProfileDetail label="Afecțiuni" value={client.medical_history?.conditions} />
            <ProfileDetail label="Medicamente" value={client.medical_history?.medications} />
            <ProfileDetail label="Leziuni anterioare" value={client.medical_history?.previous_injuries} />
            <ProfileDetail label="Alte note" value={client.medical_history?.notes} className="col-span-2 sm:col-span-4" />
          </dl>}
        </div>

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Profil și preferințe</h2>
            {!hasProfileData && <Badge variant="neutral">Necompletat de client</Badge>}
          </div>
          {hasProfileData && <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 break-words text-sm text-zinc-600 sm:grid-cols-4">
            <ProfileDetail label="Gen" value={client.profile_data?.gender} />
            <ProfileDetail label="Localitate" value={[client.profile_data?.city, client.profile_data?.county].filter(Boolean).join(", ")} />
            <ProfileDetail label="Adresă" value={client.profile_data?.address} />
            <ProfileDetail label="Ocupație" value={client.profile_data?.occupation} />
            <ProfileDetail label="Categorie ocupație" value={client.profile_data?.occupation_category} />
            <ProfileDetail label="Contact preferat" value={client.profile_data?.preferred_contact} />
            <ProfileDetail label="Limbă preferată" value={client.profile_data?.preferred_language} />
            <ProfileDetail label="Sursă" value={client.profile_data?.referral_source} />
            <ProfileDetail label="Detalii sursă" value={client.profile_data?.referral_details} />
            <ProfileDetail label="Activitate" value={client.profile_data?.activity_level} />
            <ProfileDetail label="Obiectiv" value={client.profile_data?.primary_goal} />
            <ProfileDetail label="Obiectiv secundar" value={client.profile_data?.secondary_goal} />
            <ProfileDetail label="Interes" value={client.profile_data?.interest} />
            <ProfileDetail
              label="Acceptă comunicare marketing"
              value={client.profile_data?.communication_consent === undefined ? undefined : client.profile_data.communication_consent ? "Da" : "Nu"}
            />
          </dl>}
        </div>
      </EditableProfileCard>

      <NotesForm clientId={client.id} notes={client.notes} />

      <section className="mm-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Declarații semnate</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {consentTemplates.map((t) => {
            const signed = signedTypes.has(t.type);
            return (
              <Badge key={t.type} variant={signed ? "success" : "neutral"}>
                {signed ? <Check size={13} aria-hidden /> : <Minus size={13} aria-hidden />} {t.label}
              </Badge>
            );
          })}
        </div>
      </section>
      </>}

      {activeTab === "dosar" && <section className="space-y-8">

        <div>
          <h2 className="text-base font-semibold text-zinc-900">{treatmentTemplate?.name ?? "Fișa de tratament"}</h2>
          <p className="text-sm text-zinc-500">
            Fiecare ședință, cea mai recentă prima. Ședința de azi se completează din{" "}
            {upcomingAppointments[0] ? (
              <Link href={`/admin/consult/${upcomingAppointments[0].id}`} className="font-medium text-[var(--mitmed-teal)] hover:underline">
                Consult
              </Link>
            ) : (
              "Consult"
            )}
            .
          </p>
          <div className="mt-3 mm-card p-4">
            <MedicalRecordsPanel
              clientId={client.id}
              records={client.medical_records}
              extraFields={treatmentFields}
              therapies={therapies}
              isAdmin={isAdmin}
            />
          </div>
          <details className="group mt-3">
            <summary className="cursor-pointer text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
              Adaugă o ședință fără programare (ex. completare ulterioară)
            </summary>
            <MedicalRecordForm
              clientId={client.id}
              therapies={therapies}
              extraFields={treatmentFields.filter((f) => !f.archived)}
              isAdmin={isAdmin}
            />
          </details>
        </div>

        {/* Cele două fișe principale stau separat: consultația (prima vizită /
            reconsult) și tratamentul (fiecare ședință). */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Fișa de consultație</h2>
          <p className="text-sm text-zinc-500">Completată la prima vizită sau la revenire după o perioadă.</p>
          <div className="mt-3">
            {consultationTemplate && (
              <SheetsPanel
                clientId={client.id}
                template={consultationTemplate}
                sheets={sheetsOf(TEMPLATE_CONSULTATIE)}
                fields={fieldsOf(TEMPLATE_CONSULTATIE)}
                patient={patientHeader}
                isAdmin={isAdmin}
              />
            )}
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-zinc-900">Alte fișe medicale</h2>
          <p className="text-sm text-zinc-500">
            Fișe construite din Setări → Fișe medicale.
            {isAdmin && <> <Link href="/admin/fisa-consultatie?t=nou" className="text-sky-600 hover:underline">Construiește o fișă nouă</Link></>}
          </p>
          <div className="mt-3 space-y-3">
            {customTemplates.map((t) => (
              <SheetsPanel
                key={t.id}
                clientId={client.id}
                template={t}
                sheets={sheetsOf(t.id)}
                fields={fieldsOf(t.id)}
                patient={patientHeader}
                isAdmin={isAdmin}
              />
            ))}
            {customTemplates.length === 0 && <p className="text-sm text-zinc-400">Nicio altă fișă definită încă.</p>}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">Terapii și fidelitate</h2>
          <UnlockedTherapiesForm
            clientId={client.id}
            therapies={therapiesRaw.map((t) => ({ id: t.id, name: t.name, is_consultation: t.is_consultation }))}
            unlockedTherapyIds={client.unlocked_therapy_ids}
          />
          <FidelityCardsPanel clientId={client.id} cards={fidelityCards} cardTypes={fidelityCardTypes} isAdmin={isAdmin} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-zinc-900">Documente</h2>
          <PatientDocumentsPanel clientId={client.id} documents={documents} />
        </div>
        <details className="mm-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
            Date pacient pentru fișe (CNP, adresă, ocupație)
            <span className="ml-2 font-normal text-zinc-500">— apar în antetul fișelor PDF</span>
          </summary>
          <div className="mt-3">
            <PatientDetailsForm clientId={client.id} client={client} />
          </div>
        </details>
      </section>}

      {activeTab === "plati" && <section>
        <h2 className="text-base font-semibold text-zinc-900">Plăți</h2>

        {activeFidelityCards.length > 0 && (
          <div className="mt-3 mm-card p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Card de fidelitate</h3>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              {activeFidelityCards.map((card) => (
                <div key={card.id}>
                  <p className="text-sm font-semibold text-zinc-800">{card.card_type_name}</p>
                  <div className="mt-2">
                    <FidelityCardProgress card={card} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Reducerile de fidelitate se aplică automat în totalul de mai jos, pe ședințe: terapiile din aceeași zi sunt o singură ședință și primesc aceeași reducere. Ședințele din pachete nu se numără.
            </p>
          </div>
        )}

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
                    {g.status === "PARTIAL" && (
                      <span className="ml-1 text-xs text-zinc-400">({g.totalPaid.toFixed(2)} încasați)</span>
                    )}
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
                {(g.status !== "PLATIT" || (g.totalPaid > 0 && !g.paidViaPayu) || (isAdmin && !g.paidViaPayu)) && (
                  <div className="mt-3 flex flex-col items-end gap-1.5 border-t border-zinc-100 pt-3">
                    {g.status !== "PLATIT" && (
                      <MarkPaidControl
                        target={{ packagePurchaseId: g.purchaseId }}
                        clientId={client.id}
                        remaining={g.remaining}
                      />
                    )}
                    {g.totalPaid > 0 && !g.paidViaPayu && (
                      <CorrectPaymentControl
                        target={{ packagePurchaseId: g.purchaseId }}
                        clientId={client.id}
                        currentAmountPaid={g.totalPaid}
                      />
                    )}
                    {isAdmin && !g.paidViaPayu && (
                      <DeletePaymentControl
                        target={{ packagePurchaseId: g.purchaseId }}
                        clientId={client.id}
                        label={`Pachet ${g.packageName}`}
                      />
                    )}
                  </div>
                )}
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {singlePayments.map((p) => {
                  const remaining = Number(p.final_price) - Number(p.amount_paid);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-zinc-50/70">
                      <td className="px-4 py-2 text-zinc-600">{new Date(p.created_at).toLocaleDateString("ro-RO")}</td>
                      <td className="px-4 py-2">{p.therapy.name}</td>
                      <td className="px-4 py-2">{p.base_price} RON</td>
                      <td className="px-4 py-2">
                        {p.discount_amount !== "0" && p.discount_amount !== "0.00" ? `-${p.discount_amount} RON` : "—"}
                        {p.coupon ? ` (${p.coupon.code})` : ""}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.final_price} RON
                        {p.status === "PARTIAL" && (
                          <span className="block text-xs font-normal text-zinc-400">{p.amount_paid} încasați</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {p.package_total_sessions
                          ? `${p.sessions_used}/${p.package_total_sessions} folosite`
                          : "—"}
                      </td>
                      <td className="px-4 py-2"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col items-end gap-1">
                          {p.status !== "PLATIT" && (
                            <MarkPaidControl target={{ paymentId: p.id }} clientId={client.id} remaining={remaining} />
                          )}
                          {Number(p.amount_paid) > 0 && !p.paid_via_payu && (
                            <CorrectPaymentControl
                              target={{ paymentId: p.id }}
                              clientId={client.id}
                              currentAmountPaid={Number(p.amount_paid)}
                            />
                          )}
                          {isAdmin && !p.paid_via_payu && (
                            <DeletePaymentControl
                              target={{ paymentId: p.id }}
                              clientId={client.id}
                              label={`${p.therapy.name} · ${p.final_price} RON`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {singlePayments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                      Nicio plată individuală încă.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div id="incaseaza" className="scroll-mt-24">
        <PaymentForm
          clientId={client.id}
          therapies={therapies}
          coupons={coupons}
          packages={activePackages}
          bookings={payableBookings}
        />
        </div>
      </section>}

      {activeTab === "programari" && <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Urmează ({upcomingAppointments.length})</h2>
          <ul className="mt-3 space-y-2">
            {upcomingAppointments.map((a) => (
              <li key={a.id} className="mm-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">
                    {formatDay(a.starts_at)}, {formatTime(a.starts_at)}
                    <span className="font-normal text-zinc-600"> · {a.therapy.name}</span>
                  </p>
                  <p className="text-xs text-zinc-500">Programată {formatBooking(a.booked_at, a.booked_by_client)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/admin/consult/${a.id}`} className="mm-btn" data-variant="primary">
                    Deschide consultul
                  </Link>
                  {isAdmin && (
                    <AppointmentAdminControls
                      appointmentId={a.id}
                      clientId={client.id}
                      startsAt={a.starts_at}
                      therapyId={a.therapy_id}
                      therapies={therapies}
                    />
                  )}
                  <CancelAppointmentButton appointmentId={a.id} clientId={client.id} startsAt={a.starts_at} isAdmin={isAdmin} />
                </div>
              </li>
            ))}
            {upcomingAppointments.length === 0 && <p className="text-sm text-zinc-500">Nicio programare viitoare.</p>}
          </ul>
        </div>

        <div id="programare-noua" className="scroll-mt-24">
        <AppointmentForm clientId={client.id} therapies={therapies} hours={hours} vacations={vacations} />
        </div>

        {pastAppointments.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Istoric</h2>
            <ul className="mt-3 divide-y divide-zinc-100 mm-card">
              {pastAppointments.map((a) => {
                const unfinished = a.status === "PROGRAMATA" || a.status === "CONFIRMATA";
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-zinc-700">
                      {formatDay(a.starts_at)}, {formatTime(a.starts_at)} · {a.therapy.name}
                    </span>
                    <span className="flex items-center gap-3">
                      <AppointmentStatusBadge status={a.status} />
                      {a.status === "FINALIZATA" && (
                        <Link href={`/admin/consult/${a.id}`} className="text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
                          Fișa ședinței
                        </Link>
                      )}
                      {unfinished && (
                        <>
                          <Link href={`/admin/consult/${a.id}`} className="mm-btn" data-variant="primary">
                            Finalizează
                          </Link>
                          <CancelAppointmentButton appointmentId={a.id} clientId={client.id} startsAt={a.starts_at} isAdmin={isAdmin} />
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>}
    </div>
  );
}

// Only filled answers are listed; an empty section shows one "not filled in" badge
// instead of a wall of dashes.
function ProfileDetail({ label, value, className }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <dt className="text-zinc-400">{label}</dt>
      <dd>{value.replaceAll("_", " ")}</dd>
    </div>
  );
}

// Randează o secțiune SOAP din fișa de consult doar dacă a fost completată —
// înregistrările mai vechi (dinainte de câmpurile S/O/A) nu au aceste valori.
