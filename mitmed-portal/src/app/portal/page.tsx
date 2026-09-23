import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, ChevronRight, ClipboardCheck, CreditCard, HeartPulse } from "lucide-react";
import { notFound } from "next/navigation";
import { getOwnClientData } from "@/actions/clients";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { listTherapies } from "@/actions/therapies";
import { CancelOwnAppointmentButton } from "./CancelOwnAppointmentButton";
import { PayOnlineButton } from "@/components/PayOnlineButton";

const ACTIVE_STATUSES = new Set(["PROGRAMATA", "CONFIRMATA"]);

function daysUntilLabel(date: Date): string {
  const today = new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((target.getTime() - day.getTime()) / 86_400_000);
  if (difference === 0) return "Astăzi";
  if (difference === 1) return "Mâine";
  if (difference <= 6) return `Peste ${difference} zile`;
  return date.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

export default async function PortalPage() {
  const [raw, consents, templates, therapies] = await Promise.all([
    getOwnClientData(),
    getOwnConsents(),
    listActiveConsentTemplates(),
    listTherapies(),
  ]);
  if (!raw) notFound();
  await connection();
  const currentTime = new Date().getTime();
  const client = raw as {
    full_name: string;
    appointments: { id: string; starts_at: string; status: string; therapy: { name: string } }[];
    payments: {
      id: string;
      therapy: { name: string };
      package_total_sessions: number | null;
      sessions_used: number;
      status: string;
      appointment_id: string | null;
    }[];
    medical_records: { id: string; session_date: string; diagnosis: string | null; therapy: { name: string } | null }[];
    profile_data: Record<string, unknown> | null;
  };
  const upcoming = client.appointments.filter((item) => ACTIVE_STATUSES.has(item.status) && new Date(item.starts_at).getTime() >= currentTime).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const next = upcoming[0];
  const nextUnpaidPaymentId = next
    ? client.payments.find((p) => p.appointment_id === next.id && p.status !== "PLATIT")?.id
    : undefined;
  const activePackages = client.payments.filter((item) => item.package_total_sessions && item.sessions_used < item.package_total_sessions);
  const signed = new Set(consents.map((item) => item.type));
  const pendingDocuments = templates.filter((item) => !signed.has(item.type)).length;
  const latestRecord = [...client.medical_records].sort((a, b) => +new Date(b.session_date) - +new Date(a.session_date))[0];
  // Dacă tot ce vede clientul e marcat `is_consultation`, n-are încă nimic
  // deblocat de medic — indiferent de câte tipuri de consultație există în
  // catalog, nu poate rezerva altceva momentan (vezi routers/therapies.py,
  // care filtrează exact așa lista pentru rolul CLIENT).
  const isConsultationOnly = therapies.length > 0 && therapies.every((t) => t.is_consultation);
  const isFirstVisit = client.medical_records.length === 0;
  const profileIncomplete = !client.profile_data || Object.keys(client.profile_data).length === 0;

  return <div className="portal-page portal-home">
    <section className="portal-intro"><p>Salut, {client.full_name.split(" ")[0]}.</p><h1>Bine ai revenit.</h1><span>Ai aici doar lucrurile care contează acum.</span></section>
    {profileIncomplete && (
      <section className="portal-profile-nudge">
        <div>
          <p className="portal-profile-nudge-title">Completează-ți profilul</p>
          <span>Câteva detalii despre tine ne ajută să îți oferim o experiență mai bună și o comunicare potrivită.</span>
        </div>
        <Link href="/portal/profil" className="portal-hero-link">Completează profilul <ChevronRight size={16} /></Link>
      </section>
    )}
    <section className="portal-next-appointment">{next ? <><div className="portal-appointment-mark"><CalendarDays size={23} /></div><div><p className="portal-hero-label">Următoarea programare</p><h2>{daysUntilLabel(new Date(next.starts_at))}</h2><p className="portal-appointment-detail">{new Date(next.starts_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })} · {next.therapy.name}</p></div><div className="portal-next-appointment-actions">{nextUnpaidPaymentId && <PayOnlineButton paymentId={nextUnpaidPaymentId} className="portal-pay-btn portal-pay-btn-hero" />}<CancelOwnAppointmentButton appointmentId={next.id} startsAt={next.starts_at} /></div></> : isConsultationOnly ? <><div className="portal-appointment-mark"><HeartPulse size={23} /></div><div><p className="portal-hero-label">{isFirstVisit ? "Prima ta vizită" : "Programarea ta"}</p><h2>Începe cu o consultație.</h2><p className="portal-appointment-detail">Înainte de orice altă terapie, trebuie să te programezi la o consultație — abia după aceea medicul îți deblochează restul serviciilor.</p></div><Link href="/portal/programari" className="portal-hero-link">Programează consultația <ChevronRight size={17} /></Link></> : <><div className="portal-appointment-mark"><HeartPulse size={23} /></div><div><p className="portal-hero-label">Programarea ta</p><h2>Gata când ești și tu.</h2><p className="portal-appointment-detail">Alege terapia și ora care ți se potrivesc.</p></div><Link href="/portal/programari" className="portal-hero-link">Programează <ChevronRight size={17} /></Link></>}</section>
    <section className="portal-home-actions" aria-label="Acces rapid">
      <Link href="/portal/programari"><CalendarDays /><span><strong>Programări</strong><small>{upcoming.length ? `${upcoming.length} viitoare` : "Alege o nouă dată"}</small></span><ChevronRight /></Link>
      <Link href="/portal/dosar"><HeartPulse /><span><strong>Dosarul meu</strong><small>{latestRecord ? "Vezi ultima recomandare" : "Istoric și recomandări"}</small></span><ChevronRight /></Link>
      <Link href="/portal/documente"><ClipboardCheck /><span><strong>Documente</strong><small>{pendingDocuments ? `${pendingDocuments} de completat` : "Toate sunt în regulă"}</small></span><ChevronRight /></Link>
      <Link href="/portal/plati"><CreditCard /><span><strong>Plăți și pachete</strong><small>{activePackages.length ? `${activePackages.length} pachete active` : "Vezi istoricul"}</small></span><ChevronRight /></Link>
    </section>
    <section className="portal-home-summary"><div><p>Progresul tău</p><h2>{client.medical_records.length} {client.medical_records.length === 1 ? "ședință înregistrată" : "ședințe înregistrate"}</h2><span>Detaliile și recomandările tale sunt în Dosarul meu.</span></div><Link href="/portal/dosar">Deschide dosarul <ChevronRight size={16} /></Link></section>
  </div>;
}
