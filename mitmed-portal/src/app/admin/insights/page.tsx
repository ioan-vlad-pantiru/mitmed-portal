import { getTherapyInsights, getOverallInsights } from "@/actions/insights";
import { IconCoin, IconAlert, IconSparkle } from "@/components/icons";
import { ExportCsvButton } from "./ExportCsvButton";

export default async function InsightsPage() {
  const [therapyInsights, overall] = await Promise.all([getTherapyInsights(), getOverallInsights()]);

  const maxRevenue = Math.max(1, ...therapyInsights.map((t) => Number(t.revenue)));
  const totalRevenue = therapyInsights.reduce((sum, t) => sum + Number(t.revenue), 0);
  const totalSessions = therapyInsights.reduce((sum, t) => sum + t.sessions_completed, 0);
  const topTherapy = therapyInsights[0];

  const kpis = [
    {
      icon: IconCoin,
      value: `${overall.revenue_this_month} RON`,
      label: "Venit luna aceasta",
      tone: "emerald" as const,
    },
    {
      icon: IconAlert,
      value: `${overall.outstanding} RON`,
      label: "Sume neîncasate",
      tone: Number(overall.outstanding) > 0 ? ("orange" as const) : ("neutral" as const),
    },
    {
      icon: IconSparkle,
      value: overall.new_clients_this_month,
      label: "Clienți noi luna aceasta",
      tone: "violet" as const,
    },
  ];

  const toneClasses: Record<string, { badge: string; icon: string; value: string }> = {
    emerald: { badge: "bg-emerald-100", icon: "text-emerald-600", value: "text-emerald-700" },
    orange: { badge: "bg-orange-100", icon: "text-orange-600", value: "text-orange-700" },
    violet: { badge: "bg-violet-100", icon: "text-violet-600", value: "text-zinc-900" },
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      <div className="mm-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Venit pe terapie</h2>
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
        </div>

        <div className="mt-5 space-y-4">
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
                  className="h-full rounded-full bg-gradient-to-r from-[var(--mitmed-sky)] to-[var(--mitmed-teal)] transition-all"
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
    </div>
  );
}
