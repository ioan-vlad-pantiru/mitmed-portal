import { cookies } from "next/headers";
import { Check, KeyRound, Keyboard, LogOut, Settings2, ShieldCheck } from "lucide-react";
import { getMySessions, getSessionUser, logout } from "@/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Button } from "@/components/ui/Button";
import { ADMIN_PAGES } from "@/lib/adminRoutes";
import { formatDateTime } from "@/lib/clinicTime";
import { Role } from "@/lib/enums";
import { SIDEBAR_COOKIE } from "@/lib/uiPrefs";
import { SidebarPreference, SignOutOthersButton } from "./AccountControls";

const ROLE_INFO: Record<string, { title: string; can: string[] }> = {
  [Role.ADMIN]: {
    title: "Administrator",
    can: [
      "Tot ce poate face recepția",
      "Corectează fișe deja salvate",
      "Setări: terapii, prețuri, program, pachete, cupoane, fișe",
      "Conturile personalului și cererile GDPR",
    ],
  },
  [Role.RECEPTIE]: {
    title: "Recepție",
    can: ["Programări și consulturi", "Clienți, fișe și documente", "Încasări, pachete și carduri de fidelitate", "Rapoartele din Insights"],
  },
};

export default async function AccountPage() {
  const [user, sessions, cookieStore] = await Promise.all([getSessionUser(), getMySessions(), cookies()]);
  const isAdmin = user.role === Role.ADMIN;
  const role = ROLE_INFO[user.role] ?? { title: user.role, can: [] };
  const email = user.email ?? "—";
  const shortcuts = ADMIN_PAGES.filter((p) => p.shortcut && (isAdmin || !p.adminOnly));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="mm-card flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--mitmed-teal)] text-2xl font-bold text-white" aria-hidden>
          {email.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900">{email}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="mm-badge" data-variant="info">
              <ShieldCheck size={13} /> {role.title}
            </span>
            {sessions.current_since && <span>Conectat aici din {formatDateTime(sessions.current_since)}</span>}
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary">
            <LogOut size={16} /> Deconectare
          </Button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card icon={KeyRound} title="Parola" description="Schimbă parola oricând crezi că a mai văzut-o cineva. Celelalte dispozitive se deconectează automat.">
            <ChangePasswordForm />
          </Card>

          <Card
            icon={ShieldCheck}
            title="Dispozitive conectate"
            description={`Contul tău e deschis acum pe ${sessions.active} ${sessions.active === 1 ? "dispozitiv" : "dispozitive"}. Dacă ai folosit un calculator străin, deconectează-l de aici.`}
          >
            <SignOutOthersButton otherDevices={Math.max(0, sessions.active - 1)} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={ShieldCheck} title={`Ce poți face ca ${role.title.toLowerCase()}`}>
            <ul className="space-y-2 text-sm text-zinc-700">
              {role.can.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--mm-success)]" /> {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={Settings2} title="Preferințe" description="Se păstrează pe acest dispozitiv.">
            <SidebarPreference collapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"} />
          </Card>

          <Card icon={Keyboard} title="Scurtături de tastatură" description="Ca să ajungi oriunde fără mouse.">
            <dl className="divide-y divide-zinc-100 text-sm">
              <Shortcut keys={["⌘", "K"]} label="Caută un client sau o pagină" />
              {shortcuts.map((p) => (
                <Shortcut key={p.href} keys={["g", p.shortcut!]} label={`Mergi la ${p.label}`} />
              ))}
              <Shortcut keys={["Esc"]} label="În consult: înapoi la bord" />
              <Shortcut keys={["[", "]"]} label="În consult: pacientul anterior / următor" />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof KeyRound;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mm-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
        <Icon size={18} className="text-[var(--mitmed-teal)]" /> {title}
      </h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-zinc-700">{label}</dt>
      <dd className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <kbd key={k} className="min-w-6 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-center text-xs font-medium text-zinc-600">
            {k}
          </kbd>
        ))}
      </dd>
    </div>
  );
}
