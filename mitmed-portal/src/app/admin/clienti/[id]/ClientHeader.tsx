import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarPlus, ClipboardList, Coins, FileWarning, Mail, Phone, Pill, Stethoscope } from "lucide-react";
import { formatDay, formatTime } from "@/lib/clinicTime";
import { formatRon } from "@/lib/format";

type Appointment = { id: string; starts_at: string; status: string; therapy: { name: string } };

/**
 * Always on top of the client file, whatever tab is open: who this is, what
 * staff must not miss (allergies, money owed, unsigned papers, unfinished
 * visits) and the next thing to do with one click.
 */
export function ClientHeader({
  clientId,
  fullName,
  birthDate,
  createdAt,
  phone,
  email,
  medicalHistory,
  appointments,
  amountOwed,
  unsignedDocuments,
  lastVisit,
  sessionsDone,
}: {
  clientId: string;
  fullName: string;
  birthDate: string | null;
  createdAt: string;
  phone: string | null;
  email: string | null;
  medicalHistory: { allergies?: string; conditions?: string; medications?: string } | null;
  appointments: Appointment[];
  amountOwed: number;
  unsignedDocuments: number;
  lastVisit: string | null;
  sessionsDone: number;
}) {
  const now = new Date().getTime();
  const active = appointments.filter((a) => a.status === "PROGRAMATA" || a.status === "CONFIRMATA");
  const next = active
    .filter((a) => new Date(a.starts_at).getTime() >= now - 2 * 3600_000)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  const unfinished = active.filter((a) => new Date(a.starts_at).getTime() < now - 2 * 3600_000);
  const age = birthDate ? Math.floor((now - new Date(birthDate).getTime()) / (365.25 * 86_400_000)) : null;
  const tab = (name: string, anchor = "") => `/admin/clienti/${clientId}?tab=${name}${anchor}`;

  const alerts = [
    medicalHistory?.allergies && { key: "allergies", tone: "danger", icon: AlertTriangle, text: `Alergii: ${medicalHistory.allergies}` },
    medicalHistory?.conditions && { key: "conditions", tone: "warning", icon: Stethoscope, text: `Afecțiuni: ${medicalHistory.conditions}` },
    medicalHistory?.medications && { key: "medications", tone: "warning", icon: Pill, text: `Medicamente: ${medicalHistory.medications}` },
    amountOwed > 0 && { key: "owed", tone: "warning", icon: Coins, text: `De încasat ${formatRon(amountOwed)}`, href: tab("plati", "#incaseaza") },
    unsignedDocuments > 0 && {
      key: "docs",
      tone: "neutral",
      icon: FileWarning,
      text: `${unsignedDocuments} ${unsignedDocuments === 1 ? "declarație nesemnată" : "declarații nesemnate"}`,
    },
    unfinished.length > 0 && {
      key: "unfinished",
      tone: "warning",
      icon: ClipboardList,
      text: `${unfinished.length} ${unfinished.length === 1 ? "vizită trecută nefinalizată" : "vizite trecute nefinalizate"}`,
      href: tab("programari"),
    },
  ].filter(Boolean) as { key: string; tone: "danger" | "warning" | "neutral"; icon: typeof Coins; text: string; href?: string }[];

  const toneClass = {
    danger: "bg-[var(--mm-danger-bg)] text-[var(--mm-danger)] border-red-200",
    warning: "bg-[var(--mm-warning-bg)] text-amber-800 border-amber-200",
    neutral: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };

  return (
    <header className="mm-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{fullName}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            {age !== null && <span>{age} ani</span>}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-medium text-[var(--mitmed-teal)] hover:underline">
                <Phone size={14} /> {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:underline">
                <Mail size={14} /> {email}
              </a>
            )}
            <span>
              {sessionsDone} {sessionsDone === 1 ? "ședință" : "ședințe"}
              {lastVisit && ` · ultima ${new Date(lastVisit).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}`}
              {` · client din ${new Date(createdAt).getFullYear()}`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && (
            <Link href={`/admin/consult/${next.id}`} className="mm-btn" data-variant="primary">
              <Stethoscope size={16} /> Deschide consultul
            </Link>
          )}
          <Link href={tab("programari", "#programare-noua")} className="mm-btn" data-variant="secondary">
            <CalendarPlus size={16} /> Programare nouă
          </Link>
          <Link href={tab("plati", "#incaseaza")} className="mm-btn" data-variant="secondary">
            <Coins size={16} /> Încasează
          </Link>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
        <CalendarClock size={16} className="text-[var(--mitmed-teal)]" />
        {next ? (
          <>
            Următoarea vizită: <strong>{formatDay(next.starts_at)}, {formatTime(next.starts_at)}</strong> · {next.therapy.name}
          </>
        ) : (
          <span className="text-zinc-500">Nicio programare viitoare.</span>
        )}
      </p>

      {alerts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {alerts.map(({ key, tone, icon: Icon, text, href }) => {
            const body = (
              <>
                <Icon size={14} className="shrink-0" /> <span className="line-clamp-1">{text}</span>
              </>
            );
            const cls = `inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass[tone]}`;
            return (
              <li key={key} className="max-w-full">
                {href ? (
                  <Link href={href} className={`${cls} hover:brightness-95`}>
                    {body}
                  </Link>
                ) : (
                  <span className={cls} title={text}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
}
