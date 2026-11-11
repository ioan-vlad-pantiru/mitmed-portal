import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Gift,
  HeartPulse,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { listTherapies } from "@/actions/therapies";
import { getOwnSurvey } from "@/actions/surveys";
import { listOwnFidelityCards } from "@/actions/fidelity";
import { PayOnlineButton } from "@/components/PayOnlineButton";
import { CLINIC_ADDRESS, CLINIC_DIRECTIONS_URL } from "@/lib/clinic";
import { CancelOwnAppointmentButton } from "./CancelOwnAppointmentButton";
import { AddToCalendarButton } from "./_components/AddToCalendarButton";
import { CallClinicLink } from "./_components/CallClinicLink";
import { clinicLocalStamp, formatDate, formatTime, relativeDay } from "@/lib/clinicTime";
import { formatRon } from "@/lib/format";
import { nextRewardLabel } from "@/components/FidelityProgress";
import {
  amountDue,
  latestAdvice,
  unpaidPayments,
  unsignedTemplates,
  upcomingAppointments,
  type ClientRecord,
  type ClientSheet,
} from "./portalData";

type Client = {
  full_name: string;
  appointments: { id: string; starts_at: string; status: string; therapy_id: string; therapy: { name: string } }[];
  payments: {
    id: string;
    therapy: { name: string };
    package_total_sessions: number | null;
    sessions_used: number;
    package_name: string | null;
    status: string;
    final_price: string;
    amount_paid: string;
    appointment_id: string | null;
  }[];
  medical_records: ClientRecord[];
  consultation_sheets: ClientSheet[];
  profile_data: Record<string, unknown> | null;
};

type Todo = { key: string; icon: React.ReactNode; title: string; detail: string; href: string; action: string; urgent?: boolean };

export default async function PortalPage() {
  const [raw, consents, templates, therapies, survey, fidelityCards] = await Promise.all([
    getOwnClientData(),
    getOwnConsents(),
    listActiveConsentTemplates(),
    listTherapies(),
    getOwnSurvey(),
    listOwnFidelityCards(),
  ]);
  if (!raw) notFound();
  await connection();
  const client = raw as Client;
  const now = new Date().getTime();

  const upcoming = upcomingAppointments(client.appointments, now);
  const next = upcoming[0];
  const nextUnpaid = next ? client.payments.find((p) => p.appointment_id === next.id && p.status !== "PLATIT") : undefined;
  const durationOf = (therapyId: string) => therapies.find((t) => t.id === therapyId)?.duration_minutes ?? 60;

  const unpaid = unpaidPayments(client.payments);
  const unpaidTotal = unpaid.reduce((sum, p) => sum + amountDue(p), 0);
  const pendingDocuments = unsignedTemplates(templates, consents);
  const profileIncomplete = !client.profile_data || Object.keys(client.profile_data).length === 0;
  const activePackages = client.payments.filter((p) => p.package_total_sessions && p.sessions_used < p.package_total_sessions);
  const advice = latestAdvice(client.medical_records, client.consultation_sheets);
  const isConsultationOnly = therapies.length > 0 && therapies.every((t) => t.is_consultation);
  const canBookOnline = therapies.some((t) => t.active);
  const firstName = client.full_name.split(" ")[0];

  const todos: Todo[] = [];
  if (pendingDocuments.length)
    todos.push({
      key: "docs",
      icon: <ClipboardCheck size={20} />,
      title: pendingDocuments.length === 1 ? "Ai un document de semnat" : `Ai ${pendingDocuments.length} documente de semnat`,
      detail: pendingDocuments.map((d) => d.label).join(", "),
      href: "/portal/documente",
      action: "Semnează",
      urgent: true,
    });
  if (unpaidTotal > 0 && !(unpaid.length === 1 && nextUnpaid))
    todos.push({
      key: "pay",
      icon: <CreditCard size={20} />,
      title: `Ai de plată ${formatRon(unpaidTotal)}`,
      detail: "Poți plăti online acum sau la recepție, când vii.",
      href: "/portal/plati",
      action: "Vezi și plătește",
      urgent: true,
    });
  if (survey?.pending)
    todos.push({
      key: "survey",
      icon: <MessageSquareText size={20} />,
      title: "Cum a fost vizita ta?",
      detail: `Un minut despre ${survey.pending.therapy_name}. Ne ajută mult.`,
      href: "/portal/sondaj",
      action: "Răspunde",
    });
  if (profileIncomplete)
    todos.push({
      key: "profile",
      icon: <UserRound size={20} />,
      title: "Spune-ne puțin despre tine",
      detail: "Opțional — ne ajută să-ți recomandăm ce ți se potrivește.",
      href: "/portal/profil",
      action: "Completează",
    });

  return (
    <div className="portal-home">
      <p className="portal-greeting">Bună, {firstName}!</p>

      {/* 1. The next visit — the main reason people open the portal. */}
      {next ? (
        <section className="portal-next-card" aria-label="Următoarea programare">
          <p className="portal-next-label">Următoarea programare</p>
          <h1 className="portal-next-when">
            {relativeDay(next.starts_at)}, ora {formatTime(next.starts_at)}
          </h1>
          <p className="portal-next-what">
            {next.therapy.name}
            {/* Relative labels ("Mâine") need the calendar date next to them. */}
            {!relativeDay(next.starts_at).includes(",") && ` · ${formatDate(next.starts_at)}`}
          </p>
          <a href={CLINIC_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="portal-next-address">
            <MapPin size={16} /> {CLINIC_ADDRESS}
          </a>
          <div className="portal-next-actions">
            {nextUnpaid && <PayOnlineButton paymentId={nextUnpaid.id} className="portal-primary-btn portal-primary-btn-light" />}
            <AddToCalendarButton
              title={next.therapy.name}
              localStart={clinicLocalStamp(next.starts_at)}
              durationMinutes={durationOf(next.therapy_id)}
              className="portal-ghost-btn"
            />
            <CallClinicLink className="portal-ghost-btn" />
          </div>
          <div className="portal-next-footer">
            <CancelOwnAppointmentButton appointmentId={next.id} startsAt={next.starts_at} />
            {upcoming.length > 1 && (
              <Link href="/portal/programari">
                încă {upcoming.length - 1} {upcoming.length - 1 === 1 ? "programare" : "programări"} <ChevronRight size={15} />
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="portal-next-card" aria-label="Programare nouă">
          <p className="portal-next-label">{isConsultationOnly ? "Primul pas" : "Nicio programare viitoare"}</p>
          {!canBookOnline ? (
            <>
              <h1 className="portal-next-when">Sună-ne pentru programare</h1>
              <p className="portal-next-what">Momentan programarea se face telefonic. Te ajutăm să găsești ora potrivită.</p>
              <div className="portal-next-actions">
                <CallClinicLink className="portal-primary-btn portal-primary-btn-light" />
              </div>
            </>
          ) : (
            <>
          <h1 className="portal-next-when">{isConsultationOnly ? "Începe cu o consultație" : "Când vrei să vii?"}</h1>
          <p className="portal-next-what">
            {isConsultationOnly
              ? "Medicul te evaluează, apoi îți deblochează terapiile potrivite pentru tine."
              : "Alege terapia, ziua și ora. Durează mai puțin de un minut."}
          </p>
          <div className="portal-next-actions">
            <Link href="/portal/programari#programeaza" className="portal-primary-btn portal-primary-btn-light">
              {isConsultationOnly ? <Stethoscope size={18} /> : <CalendarDays size={18} />}
              {isConsultationOnly ? "Programează consultația" : "Programează-te"}
            </Link>
            <CallClinicLink className="portal-ghost-btn" label="Sau sună-ne" />
          </div>
            </>
          )}
        </section>
      )}

      {/* 2. Things waiting on the client. */}
      {todos.length > 0 && (
        <section aria-labelledby="todo-title">
          <h2 id="todo-title" className="portal-section-title">
            De făcut
          </h2>
          <ul className="portal-todo-list">
            {todos.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className={t.urgent ? "is-urgent" : ""}>
                  <span className="portal-todo-icon">{t.icon}</span>
                  <span className="portal-todo-text">
                    <strong>{t.title}</strong>
                    <small>{t.detail}</small>
                  </span>
                  <span className="portal-todo-action">
                    {t.action} <ChevronRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. Progress: loyalty cards and packages. */}
      {(fidelityCards.length > 0 || activePackages.length > 0) && (
        <section aria-labelledby="progress-title">
          <h2 id="progress-title" className="portal-section-title">
            Beneficiile tale
          </h2>
          <div className="portal-progress-grid">
            {fidelityCards.map((card) => {
              const reward = card.next_reward;
              const text = nextRewardLabel(card, "client") ?? "Strângi ședințe pentru următoarea reducere";
              return (
                <Link key={card.id} href="/portal/plati" className="portal-progress-card">
                  <span className="portal-progress-head">
                    <Gift size={18} /> {card.card_type_name}
                  </span>
                  <strong className={reward?.sessions_left === 0 ? "text-[var(--mm-success)]" : ""}>{text}</strong>
                  <span className="portal-progress-bar" aria-hidden>
                    <i style={{ width: `${Math.min(100, (card.stamps / Math.max(1, card.cycle_length)) * 100)}%` }} />
                  </span>
                  <small>
                    {card.stamps} din {card.cycle_length} ședințe
                  </small>
                </Link>
              );
            })}
            {activePackages.map((p) => {
              const total = p.package_total_sessions ?? 1;
              const left = total - p.sessions_used;
              return (
                <Link key={p.id} href="/portal/plati" className="portal-progress-card">
                  <span className="portal-progress-head">
                    <PackageCheck size={18} /> {p.package_name ?? "Pachet"}
                  </span>
                  <strong>
                    Mai ai {left} {left === 1 ? "ședință" : "ședințe"} de {p.therapy.name}
                  </strong>
                  <span className="portal-progress-bar" aria-hidden>
                    <i style={{ width: `${(p.sessions_used / total) * 100}%` }} />
                  </span>
                  <small>
                    {p.sessions_used} din {total} folosite · deja plătite
                  </small>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. What the therapist recommended last time. */}
      {advice && (
        <section aria-labelledby="advice-title">
          <h2 id="advice-title" className="portal-section-title">
            Ultima recomandare
          </h2>
          <Link href="/portal/dosar" className="portal-advice-card">
            <HeartPulse size={20} />
            <span>
              <small>
                {formatDate(advice.date)} · {advice.source}
              </small>
              <strong>{advice.text}</strong>
              <em>
                Vezi tot dosarul <ChevronRight size={15} />
              </em>
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
