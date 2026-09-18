import { getTherapyInsights, getOverallInsights, getClientInsights, type Distribution } from "@/actions/insights";
import { IconCoin, IconSparkle } from "@/components/icons";
import { ExportCsvButton } from "./ExportCsvButton";
import { OutstandingTrigger } from "./OutstandingDialog";

const RON = (v: number) => `${v.toLocaleString("ro-RO")} RON`;

export default async function InsightsPage() {
  const [therapyInsights, overall, clientInsights] = await Promise.all([
    getTherapyInsights(),
    getOverallInsights(),
    getClientInsights(),
  ]);

  const maxRevenue = Math.max(1, ...therapyInsights.map((t) => Number(t.revenue)));
  const totalRevenue = therapyInsights.reduce((sum, t) => sum + Number(t.revenue), 0);
  const totalSessions = therapyInsights.reduce((sum, t) => sum + t.sessions_completed, 0);
  const topTherapy = therapyInsights[0];
  const maxMonthlyRevenue = Math.max(1, ...overall.monthly_revenue.map((item) => Number(item.revenue)));
  const cancellationRate = overall.completed_sessions_this_month + overall.cancelled_sessions_this_month
    ? Math.round((overall.cancelled_sessions_this_month / (overall.completed_sessions_this_month + overall.cancelled_sessions_this_month)) * 100)
    : 0;
  const retentionRate = overall.clients_with_completed_sessions
    ? Math.round((overall.returning_clients / overall.clients_with_completed_sessions) * 100)
    : 0;

  const kpis = [
    {
      icon: IconCoin,
      value: `${overall.revenue_this_month} RON`,
      label: "Venit luna aceasta",
      tone: "emerald" as const,
    },
    {
      icon: IconSparkle,
      value: overall.new_clients_this_month,
      label: "Clienți noi luna aceasta",
      tone: "violet" as const,
    },
    {
      icon: IconSparkle,
      value: overall.completed_sessions_this_month,
      label: "Ședințe finalizate luna aceasta",
      tone: "neutral" as const,
    },
  ];

  const toneClasses: Record<string, { badge: string; icon: string; value: string }> = {
    emerald: { badge: "bg-emerald-100", icon: "text-emerald-600", value: "text-emerald-700" },
    orange: { badge: "bg-orange-100", icon: "text-orange-600", value: "text-orange-700" },
    violet: { badge: "bg-violet-100", icon: "text-violet-600", value: "text-violet-800" },
    neutral: { badge: "bg-zinc-100", icon: "text-zinc-400", value: "text-zinc-900" },
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Insights</h1>
          <p className="text-sm text-zinc-500">Venituri, restanțe și performanța fiecărei terapii.</p>
        </div>
        <ExportCsvButton />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OutstandingTrigger totalLabel={`${overall.outstanding} RON`} />
        {kpis.map((kpi) => {
          const tone = toneClasses[kpi.tone];
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="mm-card p-5">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${tone.badge}`}>
                <Icon className={`h-5 w-5 ${tone.icon}`} />
              </span>
              <div className={`mm-numeric mt-3 text-3xl font-bold tracking-tight ${tone.value}`}>{kpi.value}</div>
              <div className="text-sm text-zinc-500">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-zinc-500">
        <span className="mm-numeric font-semibold text-zinc-800">{totalRevenue.toLocaleString("ro-RO")} RON</span>{" "}
        încasați din <span className="mm-numeric font-semibold text-zinc-800">{totalSessions}</span> ședințe
        {topTherapy && (
          <>
            {" "}
            · cea mai profitabilă: <span className="font-medium text-zinc-800">{topTherapy.name}</span>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
        <section className="mm-card p-5">
          <div className="flex items-baseline justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight text-zinc-900">Evoluția încasărilor</h2><p className="mt-1 text-sm text-zinc-500">Ultimele șase luni calendaristice, pe plăți încasate.</p></div><span className="text-xs font-medium text-zinc-400">RON</span></div>
          <div className="mt-6 grid h-44 grid-cols-6 items-end gap-3" aria-label="Grafic venituri pe ultimele șase luni">
            {overall.monthly_revenue.map((item) => <div key={item.month} className="grid h-full min-w-0 grid-rows-[1fr_auto] gap-2"><div className="flex items-end rounded-t-md bg-zinc-100"><div className="w-full rounded-t-md bg-[var(--mitmed-teal)] transition-[height]" style={{ height: `${Math.max(Number(item.revenue) ? 7 : 0, (Number(item.revenue) / maxMonthlyRevenue) * 100)}%` }} title={RON(Number(item.revenue))} /></div><div className="text-center"><span className="block text-[11px] font-semibold text-zinc-700">{new Intl.DateTimeFormat("ro-RO", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`)).replace(".", "")}</span><span className="mm-numeric block text-[10px] text-zinc-400">{Number(item.revenue) ? `${Math.round(Number(item.revenue) / 1000)}k` : "—"}</span></div></div>)}
          </div>
        </section>
        <section className="mm-card p-5"><h2 className="text-base font-semibold tracking-tight text-zinc-900">Semnale operaționale</h2><dl className="mt-4 divide-y divide-zinc-100"><div className="flex items-center justify-between gap-4 py-3 first:pt-0"><dt className="text-sm text-zinc-600">Anulări luna aceasta</dt><dd className="mm-numeric text-right text-sm font-semibold text-zinc-900">{overall.cancelled_sessions_this_month} <span className="font-normal text-zinc-400">({cancellationRate}%)</span></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-zinc-600">Clienți care revin</dt><dd className="mm-numeric text-right text-sm font-semibold text-zinc-900">{overall.returning_clients} <span className="font-normal text-zinc-400">({retentionRate}%)</span></dd></div><div className="flex items-center justify-between gap-4 py-3 pb-0"><dt className="text-sm text-zinc-600">Dosare cu profil complet</dt><dd className="mm-numeric text-right text-sm font-semibold text-zinc-900">{clientInsights.total_clients ? Math.round((clientInsights.profiles_completed / clientInsights.total_clients) * 100) : 0}%</dd></div></dl></section>
      </div>

      <div className="mm-card p-5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Venit pe terapie</h2>
          <p className="text-sm text-zinc-500">Comparație directă — util când valorile sunt apropiate.</p>
          <div className="mt-4 space-y-4">
            {therapyInsights.map((t) => (
              <div key={t.id} className={t.active ? "" : "opacity-50"}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-zinc-800">
                    {t.name}
                    {!t.active && <span className="ml-2 text-xs font-normal text-zinc-400">(inactivă)</span>}
                  </span>
                  <span className="mm-numeric font-semibold text-zinc-900">{t.revenue} RON</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[var(--mitmed-teal)] transition-all"
                    style={{ width: `${Math.max(2, (Number(t.revenue) / maxRevenue) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {t.sessions_completed} ședințe finalizate · {t.distinct_clients} clienți unici
                </p>
              </div>
            ))}
            {therapyInsights.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-400">Niciun cont de terapie încă.</p>
            )}
          </div>
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Detaliu</h2>
        <div className="mt-3 overflow-hidden mm-card">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Terapie</th>
                <th className="px-4 py-2.5">Ședințe finalizate</th>
                <th className="px-4 py-2.5">Clienți unici</th>
                <th className="px-4 py-2.5">Venit încasat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {therapyInsights.map((t) => (
                <tr key={t.id} className={`transition-colors hover:bg-zinc-50/70 ${t.active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {t.name}
                    {!t.active && <span className="ml-2 text-xs font-normal text-zinc-400">(inactivă)</span>}
                  </td>
                  <td className="mm-numeric px-4 py-3 text-zinc-600">{t.sessions_completed}</td>
                  <td className="mm-numeric px-4 py-3 text-zinc-600">{t.distinct_clients}</td>
                  <td className="mm-numeric px-4 py-3 font-semibold text-zinc-900">{t.revenue} RON</td>
                </tr>
              ))}
              {therapyInsights.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    Niciun cont de terapie încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Profilul clienților</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {clientInsights.profiles_completed} din {clientInsights.total_clients} profiluri au date opționale completate.
              Grupele cu mai puțin de 3 clienți nu sunt afișate.
            </p>
          </div>
          <span className="mm-numeric text-sm font-semibold text-zinc-700">
            {clientInsights.total_clients ? Math.round((clientInsights.profiles_completed / clientInsights.total_clients) * 100) : 0}% completare
          </span>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DistributionPanel title="Grupe de vârstă" data={clientInsights.age_groups} />
          <DistributionPanel title="Cum au aflat de noi" data={clientInsights.referral_sources} />
          <DistributionPanel title="Obiectiv principal" data={clientInsights.primary_goals} />
          <DistributionPanel title="Nivel de activitate" data={clientInsights.activity_levels} />
          <DistributionPanel title="Tip de activitate profesională" data={clientInsights.occupation_categories} />
          <DistributionPanel title="Localități frecvente" data={clientInsights.cities} />
        </div>
      </section>
    </div>
  );
}

const profileLabels: Record<string, string> = {
  RECOMANDARE: "Recomandare", GOOGLE: "Google", FACEBOOK_INSTAGRAM: "Facebook / Instagram", SITE: "Site",
  MEDIC: "Medic", EVENIMENT: "Eveniment", ALTELE: "Altele", DURERE: "Reducerea durerii", MOBILITATE: "Mobilitate",
  RECUPERARE: "Recuperare", PREVENȚIE: "Prevenție", PERFORMANȚĂ: "Performanță", STARE_DE_BINE: "Stare de bine",
  SCĂZUT: "Scăzut", MODERAT: "Moderat", RIDICAT: "Ridicat", SEDENTAR: "Preponderent sedentară", ACTIV: "Activă",
  MUNCA_FIZICA: "Muncă fizică", PENSIONAR: "Pensionar", ELEV_STUDENT: "Elev / student",
};

function DistributionPanel({ title, data }: { title: string; data: Distribution[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="mm-card p-4">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      {data.length ? (
        <div className="mt-3 space-y-2.5">
          {data.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between gap-3 text-xs text-zinc-600">
                <span>{profileLabels[item.label] ?? item.label}</span><span className="mm-numeric font-semibold text-zinc-800">{item.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-[var(--mitmed-teal)]" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-zinc-400">Încă nu sunt suficiente răspunsuri.</p>}
    </div>
  );
}
