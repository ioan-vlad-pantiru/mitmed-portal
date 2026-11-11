import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import {
  getClientInsights,
  getInsightsReport,
  type DrillQuery,
  type Distribution,
  type InsightsReport,
  type ReportScope,
} from "@/actions/insights";
import { RevenueDonut } from "@/components/RevenueDonut";
import { ExportCsvButton } from "./ExportCsvButton";
import { OutstandingTrigger } from "./OutstandingDialog";
import { PeriodPicker } from "./PeriodPicker";
import { insightsHref } from "./href";
import { TrendChart } from "./TrendChart";
import { Drill } from "@/components/Drill";
import { BarList, DeltaChip, KpiCard, Panel, delta, ron, type Delta } from "./ui";
import { buildVerdicts } from "./verdicts";
import { AttentionList } from "@/components/AttentionList";
import { profileLabel } from "./profileLabels";

const TABS = [
  { key: "overview", label: "Pe scurt" },
  { key: "money", label: "Bani" },
  { key: "therapies", label: "Terapii" },
  { key: "clients", label: "Clienți" },
  { key: "schedule", label: "Program" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SCOPES: ReportScope[] = ["day", "month", "year", "all"];
const WEEKDAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scope?: string; date?: string }>;
}) {
  const params = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "overview";
  const scope: ReportScope = SCOPES.includes(params.scope as ReportScope) ? (params.scope as ReportScope) : "month";
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;

  const report = await getInsightsReport(scope, date);
  const { period } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Insights</h1>
          <p className="text-sm text-zinc-500">
            Cum merge clinica. Apasă pe orice număr sau bară ca să vezi exact ce e în spatele lui.
          </p>
        </div>
        <ExportCsvButton />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight text-[var(--mitmed-teal-deep)]">{period.label}</p>
          <p className="text-sm text-zinc-500">
            {period.compare_label
              ? `Săgețile verzi/roșii compară ${period.compare_label}.`
              : "Toate datele, de la prima înregistrare."}
          </p>
        </div>
        <PeriodPicker
          tab={tab}
          scope={scope}
          anchor={period.anchor}
          label={period.label}
          prevAnchor={period.prev_anchor}
          nextAnchor={period.next_anchor}
          isCurrent={period.is_current}
        />
      </div>

      <nav aria-label="Secțiuni" className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={insightsHref(t.key, scope, date)}
            aria-current={t.key === tab ? "page" : undefined}
            className={`relative shrink-0 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              t.key === tab ? "text-[var(--mitmed-teal-deep)]" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
            {t.key === tab && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--mitmed-teal)]" />}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab report={report} />}
      {tab === "money" && <MoneyTab report={report} />}
      {tab === "therapies" && <TherapiesTab report={report} />}
      {tab === "clients" && <ClientsTab report={report} />}
      {tab === "schedule" && <ScheduleTab report={report} />}
    </div>
  );
}

function baseQuery(report: InsightsReport): Omit<DrillQuery, "metric"> {
  return { scope: report.period.scope, date: report.period.anchor };
}

function kpiCards(report: InsightsReport) {
  const { current: c, previous: p, period } = report;
  const q = baseQuery(report);
  const cmp = period.compare_label;
  const prevText = (v: number | null | undefined, fmt: (n: number) => string = String) =>
    p && v != null ? fmt(v) : null;
  const pctText = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);

  return {
    revenue: (
      <KpiCard
        label="Încasări"
        value={ron(c.revenue)}
        hint="Bani intrați efectiv (numerar, card, online)."
        d={delta(c.revenue, p?.revenue)}
        previous={prevText(p?.revenue, (n) => ron(n))}
        compareLabel={cmp}
        query={{ ...q, metric: "revenue" }}
        drillTitle="Încasări"
      />
    ),
    sessions: (
      <KpiCard
        label="Ședințe finalizate"
        value={String(c.sessions)}
        hint={c.booked_ahead ? `+ ${c.booked_ahead} încă programate în perioadă.` : "Vizite încheiate."}
        d={delta(c.sessions, p?.sessions)}
        previous={prevText(p?.sessions)}
        compareLabel={cmp}
        query={{ ...q, metric: "sessions" }}
        drillTitle="Ședințe finalizate"
      />
    ),
    avg: (
      <KpiCard
        label="Încasat pe vizită"
        value={c.avg_per_visit != null ? ron(c.avg_per_visit) : "—"}
        hint="Încasări împărțite la ședințe. Crește cu pachete și terapii combinate."
        d={delta(c.avg_per_visit, p?.avg_per_visit)}
        previous={prevText(p?.avg_per_visit, (n) => ron(n))}
        compareLabel={cmp}
        query={{ ...q, metric: "revenue" }}
        drillTitle="Încasări"
      />
    ),
    newClients: (
      <KpiCard
        label="Clienți noi"
        value={String(c.new_clients)}
        hint="Conturi noi create în perioadă."
        d={delta(c.new_clients, p?.new_clients)}
        previous={prevText(p?.new_clients)}
        compareLabel={cmp}
        query={{ ...q, metric: "new_clients" }}
        drillTitle="Clienți noi"
      />
    ),
    activeClients: (
      <KpiCard
        label="Clienți tratați"
        value={String(c.active_clients)}
        hint={`${c.returning_clients} reveniți · ${c.first_time_clients} la prima vizită.`}
        d={delta(c.active_clients, p?.active_clients)}
        previous={prevText(p?.active_clients)}
        compareLabel={cmp}
        query={{ ...q, metric: "active_clients" }}
        drillTitle="Clienți tratați în perioadă"
      />
    ),
    returnRate: (
      <KpiCard
        label="Clienți care revin"
        value={pctText(c.return_rate)}
        hint="Din clienții tratați, câți mai fuseseră înainte. Peste 60% e foarte bine."
        d={delta(c.return_rate, p?.return_rate, { points: true })}
        previous={prevText(p?.return_rate, (n) => `${Math.round(n)}%`)}
        compareLabel={cmp}
        status={c.return_rate == null || c.active_clients < 5 ? "none" : c.return_rate >= 60 ? "good" : c.return_rate < 30 ? "bad" : "none"}
        query={{ ...q, metric: "returning_clients" }}
        drillTitle="Clienți care revin"
      />
    ),
    cancellations: (
      <KpiCard
        label="Anulări"
        value={c.cancellation_rate != null ? `${c.cancellation_rate.toLocaleString("ro-RO")}%` : "—"}
        hint={`${c.cancelled} programări anulate. Sub 10% e bine, peste 15% e mult.`}
        d={delta(c.cancellation_rate, p?.cancellation_rate, { points: true, higherIsBetter: false })}
        previous={prevText(p?.cancellation_rate, (n) => `${n.toLocaleString("ro-RO")}%`)}
        compareLabel={cmp}
        status={c.cancellation_rate == null ? "none" : c.cancellation_rate >= 15 ? "bad" : c.cancellation_rate <= 10 ? "good" : "none"}
        query={{ ...q, metric: "cancelled" }}
        drillTitle="Programări anulate"
      />
    ),
    rating: (
      <KpiCard
        label="Satisfacție"
        value={c.rating_average != null ? `${c.rating_average.toLocaleString("ro-RO")} / 5` : "—"}
        hint={c.rating_count ? `${c.rating_count} răspunsuri · ${c.satisfied_share}% mulțumiți (nota 4+).` : "Niciun răspuns la sondaj în perioadă."}
        d={delta(c.rating_average, p?.rating_average)}
        previous={prevText(p?.rating_average, (n) => n.toLocaleString("ro-RO"))}
        compareLabel={cmp}
        status={c.rating_average == null ? "none" : c.rating_average >= 4.5 ? "good" : c.rating_average < 4 ? "bad" : "none"}
        query={{ ...q, metric: "ratings" }}
        drillTitle="Răspunsuri la sondaj"
      />
    ),
    discounts: (
      <KpiCard
        label="Reduceri acordate"
        value={ron(c.discounts)}
        hint="Cupoane, pachete și carduri de fidelitate."
        d={delta(c.discounts, p?.discounts, { higherIsBetter: false })}
        previous={prevText(p?.discounts, (n) => ron(n))}
        compareLabel={cmp}
        query={{ ...q, metric: "discounts" }}
        drillTitle="Reduceri acordate"
      />
    ),
    packages: (
      <KpiCard
        label="Pachete vândute"
        value={String(c.packages_sold)}
        hint="Clienți care s-au angajat pentru mai multe ședințe."
        d={delta(c.packages_sold, p?.packages_sold)}
        previous={prevText(p?.packages_sold)}
        compareLabel={cmp}
        query={{ ...q, metric: "packages_sold" }}
        drillTitle="Pachete vândute"
      />
    ),
    outstanding: (
      <KpiCard
        label="De încasat (acum)"
        value={ron(report.attention.outstanding_total)}
        hint={`${report.attention.outstanding_count} plăți neachitate, indiferent de perioadă.`}
        status={report.attention.outstanding_total > 0 ? "bad" : "good"}
        query={{ metric: "outstanding" }}
        drillTitle="Sume de încasat"
      />
    ),
  };
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

// --- Pe scurt ------------------------------------------------------------------------

function OverviewTab({ report }: { report: InsightsReport }) {
  const k = kpiCards(report);
  const { good, bad } = buildVerdicts(report);

  return (
    <div className="space-y-6">
      <KpiGrid>
        {k.revenue}
        {k.sessions}
        {k.newClients}
        {k.cancellations}
        {k.avg}
        {k.returnRate}
        {k.rating}
        {k.outstanding}
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <VerdictList
          title="Ce merge bine"
          icon={<TrendingUp className="h-5 w-5 text-[var(--mm-success)]" />}
          tone="good"
          items={good}
          empty={report.previous ? "Nicio îmbunătățire clară față de perioada precedentă." : "Alege o zi, o lună sau un an ca să vezi comparații."}
        />
        <VerdictList
          title="Ce merge mai slab"
          icon={<TrendingDown className="h-5 w-5 text-[var(--mm-danger)]" />}
          tone="bad"
          items={bad}
          empty="Nimic îngrijorător în această perioadă."
        />
      </div>

      <AttentionList attention={report.attention} description="Situația de azi, indiferent de perioada aleasă. Apasă ca să vezi pe cine privește." />

      <TrendChart buckets={report.series.buckets} unit={report.series.unit} periodLabel={report.period.label} />
    </div>
  );
}

function VerdictList({
  title,
  icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "good" | "bad";
  items: ReturnType<typeof buildVerdicts>["good"];
  empty: string;
}) {
  const accent = tone === "good" ? "border-l-[var(--mm-success)]" : "border-l-[var(--mm-danger)]";
  return (
    <section className="mm-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
        {icon}
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((v) => (
            <li key={v.text}>
              <Drill
                query={v.query}
                title={v.drillTitle}
                className={`group flex w-full items-center gap-3 rounded-md border-l-[3px] ${accent} bg-zinc-50/70 px-3 py-2.5 hover:bg-zinc-100/70`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">{v.text}</span>
                  {v.detail && <span className="block text-xs text-zinc-500">{v.detail}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" />
              </Drill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">{empty}</p>
      )}
    </section>
  );
}

// --- Bani ----------------------------------------------------------------------------

function MoneyTab({ report }: { report: InsightsReport }) {
  const k = kpiCards(report);
  const q = baseQuery(report);
  const m = report.methods;
  const totalMethods = m.cash + m.card + m.online + m.other;
  const aging = report.attention.outstanding_aging;
  const methodItems = (
    [
      ["cash", "Numerar", "#1baf7a"],
      ["card", "Card la recepție", "#2a78d6"],
      ["online", "Online (PayU)", "#eb6834"],
      ["other", "Nespecificat", "#a1a1aa"],
    ] as const
  )
    .filter(([key]) => m[key] > 0)
    .map(([key, label, color]) => ({
      key,
      label,
      value: m[key],
      display: ron(m[key]),
      sub: totalMethods ? `${Math.round((m[key] / totalMethods) * 100)}% din încasări` : undefined,
      color,
      query: { ...q, metric: "method", method: key },
      drillTitle: `Încasări · ${label}`,
    }));

  return (
    <div className="space-y-6">
      <KpiGrid>
        {k.revenue}
        {k.avg}
        {k.discounts}
        {k.packages}
      </KpiGrid>

      <TrendChart buckets={report.series.buckets} unit={report.series.unit} periodLabel={report.period.label} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cum s-a plătit" description="Împărțirea încasărilor din perioadă pe metode de plată.">
          <BarList items={methodItems} empty="Nicio încasare în această perioadă." />
        </Panel>

        <Panel
          title="Bani de încasat"
          description="Tot ce e neachitat acum. Cu cât e mai vechi, cu atât e mai greu de recuperat."
          action={
            report.attention.outstanding_count > 0 ? (
              <OutstandingTrigger totalLabel={ron(report.attention.outstanding_total)} compact />
            ) : undefined
          }
        >
          <BarList
            items={[
              { key: "a", label: "Mai noi de 30 de zile", value: aging.under_30, display: ron(aging.under_30), color: "#eda100", query: { metric: "outstanding" }, drillTitle: "Sume de încasat" },
              { key: "b", label: "Între 30 și 90 de zile", value: aging.d30_90, display: ron(aging.d30_90), color: "#eb6834", query: { metric: "outstanding" }, drillTitle: "Sume de încasat" },
              { key: "c", label: "Peste 90 de zile", value: aging.over_90, display: ron(aging.over_90), color: "#dc2626", query: { metric: "outstanding" }, drillTitle: "Sume de încasat" },
            ].filter((i) => i.value > 0)}
            empty="Nicio sumă restantă. Excelent!"
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Clienții care au adus cele mai multe încasări" description="În perioada aleasă.">
          <BarList
            items={report.top_clients
              .filter((c) => c.revenue > 0)
              .map((c) => ({
                key: c.client_id,
                label: c.client_name,
                value: c.revenue,
                display: ron(c.revenue),
                sub: `${c.visits} ${c.visits === 1 ? "vizită" : "vizite"} · deschide fișa`,
                href: `/admin/clienti/${c.client_id}`,
              }))}
          />
        </Panel>
        <Panel title="Cupoane folosite" description="Câte vânzări a adus fiecare cupon și cât a costat reducerea.">
          <BarList
            items={report.coupons.map((c) => ({
              key: c.id,
              label: c.code,
              value: c.uses,
              display: `${c.uses} ${c.uses === 1 ? "folosire" : "folosiri"}`,
              sub: `${ron(c.revenue)} vânzări · ${ron(c.discount)} reducere`,
              query: { ...q, metric: "coupon", coupon_id: c.id },
              drillTitle: `Cupon ${c.code}`,
            }))}
            empty="Niciun cupon folosit în această perioadă."
          />
        </Panel>
      </div>
    </div>
  );
}

// --- Terapii -------------------------------------------------------------------------

function TherapiesTab({ report }: { report: InsightsReport }) {
  const q = baseQuery(report);
  const therapies = report.therapies;
  const total = therapies.reduce((s, t) => s + t.revenue, 0);
  const top = therapies.slice(0, 5);
  const rest = therapies.slice(5).reduce((s, t) => s + t.revenue, 0);
  const slices = [...top.map((t) => ({ label: t.name, value: t.revenue })), ...(rest > 0 ? [{ label: "Altele", value: rest }] : [])];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Din ce vin banii" description="Ce parte din încasări aduce fiecare terapie.">
          <RevenueDonut slices={slices} total={total} totalLabel="încasat" formatValue={(v) => ron(v)} />
        </Panel>
        <Panel title="Cele mai cerute" description="Ședințe finalizate pe terapie. Apasă ca să vezi programările.">
          <BarList
            items={[...therapies]
              .sort((a, b) => b.sessions - a.sessions)
              .filter((t) => t.sessions > 0)
              .slice(0, 8)
              .map((t) => ({
                key: t.id,
                label: t.name,
                value: t.sessions,
                display: `${t.sessions} ședințe`,
                sub: `${t.clients} ${t.clients === 1 ? "client" : "clienți"}`,
                color: "#2a78d6",
                query: { ...q, metric: "therapy", therapy_id: t.id },
                drillTitle: t.name,
              }))}
          />
        </Panel>
      </div>

      <section className="mm-card overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Fiecare terapie, pe larg</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Verde = mai bine decât înainte, roșu = mai slab. Apasă pe un rând ca să vezi toate programările.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-y border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium text-zinc-500">
              <tr>
                <th className="px-5 py-2.5">Terapie</th>
                <th className="px-3 py-2.5">Încasări</th>
                <th className="px-3 py-2.5">Ședințe</th>
                <th className="px-3 py-2.5">Clienți</th>
                <th className="px-3 py-2.5">Pe ședință</th>
                <th className="px-3 py-2.5">Anulări</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {therapies.map((t) => {
                const cancelTone =
                  t.cancellation_rate == null ? "text-zinc-400" : t.cancellation_rate >= 15 ? "text-[var(--mm-danger)] font-semibold" : "text-zinc-600";
                return (
                  <tr key={t.id} className="hover:bg-zinc-50/70">
                    <td className="px-5 py-3">
                      <Drill query={{ ...q, metric: "therapy", therapy_id: t.id }} title={t.name} className="w-full">
                        <span className="font-medium text-zinc-900 underline-offset-2 hover:underline">{t.name}</span>
                        {!t.active && <span className="ml-2 text-xs text-zinc-400">(inactivă)</span>}
                        <span className="mt-1 block h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-zinc-100">
                          <span className="block h-full rounded-full bg-[var(--mitmed-teal)]" style={{ width: `${Math.max(2, t.share)}%` }} />
                        </span>
                        <span className="text-xs text-zinc-400">{t.share.toLocaleString("ro-RO")}% din încasări</span>
                      </Drill>
                    </td>
                    <td className="px-3 py-3">
                      <span className="mm-numeric block font-semibold text-zinc-900">{ron(t.revenue)}</span>
                      <ChipIfCompared d={report.previous ? delta(t.revenue, t.prev_revenue) : null} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="mm-numeric block text-zinc-800">{t.sessions}</span>
                      <ChipIfCompared d={report.previous ? delta(t.sessions, t.prev_sessions) : null} />
                    </td>
                    <td className="mm-numeric px-3 py-3 text-zinc-600">{t.clients}</td>
                    <td className="mm-numeric px-3 py-3 text-zinc-600">{t.avg_per_session != null ? ron(t.avg_per_session) : "—"}</td>
                    <td className={`mm-numeric px-3 py-3 ${cancelTone}`}>
                      {t.cancelled}
                      {t.cancellation_rate != null && <span className="ml-1 text-xs">({t.cancellation_rate.toLocaleString("ro-RO")}%)</span>}
                    </td>
                  </tr>
                );
              })}
              {therapies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">
                    Nicio ședință sau încasare în această perioadă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChipIfCompared({ d }: { d: Delta | null }) {
  if (!d) return null;
  return (
    <span className="mt-1 block">
      <DeltaChip d={d} />
    </span>
  );
}

// --- Clienți -------------------------------------------------------------------------

async function ClientsTab({ report }: { report: InsightsReport }) {
  const k = kpiCards(report);
  const q = baseQuery(report);
  const a = report.attention;
  const profile = await getClientInsights();
  const sourcesTotal = report.new_client_sources.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <KpiGrid>
        {k.newClients}
        {k.activeClients}
        {k.returnRate}
        {k.rating}
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <AttentionTile
          count={a.at_risk_clients}
          title="Nu au mai revenit"
          detail="Clienți cu 2+ vizite, dar fără vizită în ultimele 45 de zile și fără programare. Un telefon îi poate aduce înapoi."
          query={{ metric: "at_risk" }}
        />
        <AttentionTile
          count={a.unused_packages_idle}
          title="Au ședințe plătite nefolosite"
          detail={`Pachete cu ședințe rămase și nicio programare (${a.unused_package_sessions} ședințe în total, la ${a.unused_packages_clients} clienți).`}
          query={{ metric: "unused_packages" }}
        />
        <AttentionTile
          count={a.pending_booking_requests}
          title="Cereri noi de pe site"
          detail="Oameni care au cerut o programare și încă așteaptă răspuns."
          query={{ metric: "pending_requests" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Clienți noi vs. clienți care revin" description="Dintre cei tratați în perioadă.">
          <BarList
            items={[
              { key: "ret", label: "Au mai fost înainte", value: report.current.returning_clients, display: String(report.current.returning_clients), color: "var(--mitmed-teal)", query: { ...q, metric: "returning_clients" }, drillTitle: "Clienți care revin" },
              { key: "new", label: "Prima perioadă la noi", value: report.current.first_time_clients, display: String(report.current.first_time_clients), color: "#50caeb", query: { ...q, metric: "first_time_clients" }, drillTitle: "Clienți la prima vizită" },
            ]}
            empty="Niciun client tratat în această perioadă."
          />
        </Panel>
        <Panel
          title="De unde au aflat clienții noi"
          description={sourcesTotal ? `Răspunsurile celor ${sourcesTotal} clienți noi din perioadă.` : "Din profilul completat de clienții noi."}
        >
          <BarList
            items={report.new_client_sources.map((s) => ({
              key: s.label,
              label: profileLabel(s.label),
              value: s.count,
              display: String(s.count),
              sub: sourcesTotal ? `${Math.round((s.count / sourcesTotal) * 100)}%` : undefined,
              color: s.label === "NECUNOSCUT" ? "#a1a1aa" : "#1baf7a",
              query: { ...q, metric: "new_clients" },
              drillTitle: "Clienți noi",
            }))}
            empty="Niciun client nou în această perioadă."
          />
        </Panel>
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Profilul tuturor clienților</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Din toate timpurile, din chestionarul opțional ({profile.profiles_completed} din {profile.total_clients} completate). Grupele
              sub 3 persoane sunt ascunse pentru confidențialitate.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DistributionPanel title="Grupe de vârstă" data={profile.age_groups} />
          <DistributionPanel title="Cum au aflat de noi" data={profile.referral_sources} />
          <DistributionPanel title="Obiectiv principal" data={profile.primary_goals} />
          <DistributionPanel title="Ce îi interesează" data={profile.interests} />
          <DistributionPanel title="Nivel de activitate" data={profile.activity_levels} />
          <DistributionPanel title="Tip de activitate profesională" data={profile.occupation_categories} />
          <DistributionPanel title="Localități frecvente" data={profile.cities} />
        </div>
      </section>
    </div>
  );
}

function AttentionTile({ count, title, detail, query }: { count: number; title: string; detail: string; query: DrillQuery }) {
  return (
    <Drill
      query={query}
      title={title}
      description={detail}
      className="mm-card group flex h-full flex-col p-4 transition-shadow hover:shadow-[var(--mm-shadow-lg)]"
    >
      <span className="flex items-center justify-between text-sm font-medium text-zinc-600">
        {title}
        <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
      </span>
      <span className={`mm-numeric mt-2 text-2xl font-bold ${count ? "text-[var(--mm-warning)]" : "text-[var(--mm-success)]"}`}>
        {count}
      </span>
      <span className="mt-1 text-xs leading-snug text-zinc-500">{detail}</span>
    </Drill>
  );
}

function DistributionPanel({ title, data }: { title: string; data: Distribution[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="mm-card p-4">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      {data.length ? (
        <div className="mt-3 space-y-2.5">
          {data.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between gap-3 text-xs text-zinc-600">
                <span>{profileLabel(item.label)}</span>
                <span className="mm-numeric font-semibold text-zinc-800">
                  {item.count} <span className="font-normal text-zinc-400">({Math.round((item.count / total) * 100)}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-[var(--mitmed-teal)]" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">Încă nu sunt suficiente răspunsuri.</p>
      )}
    </div>
  );
}

// --- Program -------------------------------------------------------------------------

function ScheduleTab({ report }: { report: InsightsReport }) {
  const k = kpiCards(report);
  const q = baseQuery(report);
  const h = report.heatmap;
  const a = report.attention;
  const c = report.current;
  const cellMap = new Map(h.cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.count]));
  const max = Math.max(1, ...h.cells.map((cell) => cell.count));
  const busiestDay = h.by_weekday.indexOf(Math.max(...h.by_weekday));
  const busiestHour = h.by_hour.reduce((top, x) => (x.count > top.count ? x : top), { hour: -1, count: 0 });
  const quietDays = h.by_weekday
    .map((count, i) => ({ count, i }))
    .filter((d) => d.i < 5)
    .sort((x, y) => x.count - y.count);
  const conversion = c.booking_requests ? Math.round((c.booking_requests_confirmed / c.booking_requests) * 100) : null;

  return (
    <div className="space-y-6">
      <KpiGrid>
        {k.sessions}
        {k.cancellations}
        <KpiCard
          label="Cereri de pe site"
          value={String(c.booking_requests)}
          hint={conversion != null ? `${conversion}% au devenit programări.` : "Nicio cerere în perioadă."}
          d={delta(c.booking_requests, report.previous?.booking_requests)}
          previous={report.previous ? String(report.previous.booking_requests) : null}
          query={{ ...q, metric: "booking_requests" }}
          drillTitle="Cereri de programare de pe site"
        />
        <KpiCard
          label="Programate, încă nefăcute"
          value={String(c.booked_ahead)}
          hint={a.stale_unfinished ? `${a.stale_unfinished} trecute și nefinalizate.` : "Toate programările trecute sunt finalizate."}
          status={a.stale_unfinished ? "bad" : "none"}
          query={{ ...q, metric: "booked" }}
          drillTitle="Programări active în perioadă"
        />
      </KpiGrid>

      <Panel
        title="Când e cea mai mare aglomerație"
        description={
          busiestHour.count
            ? `Cel mai plin: ${WEEKDAYS[busiestDay].toLowerCase()} și ora ${busiestHour.hour}:00. Cel mai liber dintre zilele lucrătoare: ${WEEKDAYS[quietDays[0].i].toLowerCase()} — bun pentru promoții sau programări noi.`
            : "Nicio programare în această perioadă."
        }
      >
        {h.cells.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th />
                  {h.hours.map((hour) => (
                    <th key={hour} className="mm-numeric pb-1 text-center font-medium text-zinc-400">
                      {hour}
                    </th>
                  ))}
                  <th className="pb-1 pl-2 text-right font-medium text-zinc-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day, wd) => (
                  <tr key={day}>
                    <th className="pr-2 text-left font-medium text-zinc-600">{day}</th>
                    {h.hours.map((hour) => {
                      const count = cellMap.get(`${wd}-${hour}`) ?? 0;
                      return (
                        <td key={hour} className="p-0">
                          {count ? (
                            <Drill
                              query={{ ...q, metric: "slot", weekday: wd, hour }}
                              title={`${day}, ${hour}:00`}
                              ariaLabel={`${day} ora ${hour}: ${count} programări`}
                              className="mm-numeric flex h-8 w-full items-center justify-center rounded-[4px] font-semibold hover:ring-2 hover:ring-[var(--mitmed-sky)]"
                            >
                              <span
                                className="flex h-full w-full items-center justify-center rounded-[4px]"
                                style={{
                                  backgroundColor: `color-mix(in srgb, var(--mitmed-teal) ${Math.round(12 + (count / max) * 88)}%, white)`,
                                  color: count / max > 0.45 ? "white" : "var(--mitmed-teal-deep)",
                                }}
                              >
                                {count}
                              </span>
                            </Drill>
                          ) : (
                            <span className="block h-8 rounded-[4px] bg-zinc-50" />
                          )}
                        </td>
                      );
                    })}
                    <td className="mm-numeric pl-2 text-right font-semibold text-zinc-700">
                      {h.by_weekday[wd] ? (
                        <Drill query={{ ...q, metric: "slot", weekday: wd }} title={`Toate programările de ${day.toLowerCase()}`} className="hover:underline">
                          {h.by_weekday[wd]}
                        </Drill>
                      ) : (
                        <span className="text-zinc-300">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-400">
              Fiecare pătrat = numărul de programări (finalizate sau încă active) care încep la acea oră. Mai închis = mai aglomerat.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Pe ore" description="Ce ore se cer cel mai mult, cumulat pe toate zilele.">
        <BarList
          items={h.by_hour
            .filter((x) => x.count > 0)
            .map((x) => ({
              key: String(x.hour),
              label: `${String(x.hour).padStart(2, "0")}:00`,
              value: x.count,
              display: `${x.count} programări`,
              query: { ...q, metric: "slot", hour: x.hour },
              drillTitle: `Programări la ora ${x.hour}:00`,
            }))}
        />
      </Panel>
    </div>
  );
}
