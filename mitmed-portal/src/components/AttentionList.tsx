import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { DrillQuery, InsightsReport } from "@/actions/insights";
import { Drill } from "@/components/Drill";
import { formatRon } from "@/lib/format";

type Attention = InsightsReport["attention"];

export type Action = {
  text: string;
  detail?: string;
  query: DrillQuery;
  drillTitle: string;
  count: number | string;
  severity: "high" | "medium" | "low";
};

/** Things someone can act on today, independent of the selected period. */
export function buildActions(a: Attention): Action[] {
  const actions: Action[] = [];
  if (a.stale_unfinished)
    actions.push({ severity: "high", count: a.stale_unfinished, text: "Programări trecute nefinalizate", detail: "Nu sunt facturate, ștampilate pe card sau trimise la sondaj până nu le finalizezi.", query: { metric: "stale_unfinished" }, drillTitle: "Programări trecute nefinalizate" });
  if (a.outstanding_total)
    actions.push({ severity: a.outstanding_aging.over_90 ? "high" : "medium", count: formatRon(a.outstanding_total, 0), text: `Bani de încasat de la ${a.outstanding_clients} ${a.outstanding_clients === 1 ? "client" : "clienți"}`, detail: a.outstanding_aging.over_90 ? `${formatRon(a.outstanding_aging.over_90, 0)} sunt restante de peste 90 de zile.` : "Plăți neachitate sau achitate parțial.", query: { metric: "outstanding" }, drillTitle: "Sume de încasat" });
  if (a.pending_booking_requests)
    actions.push({ severity: "high", count: a.pending_booking_requests, text: "Cereri de programare de pe site fără răspuns", detail: "Cu cât răspunzi mai repede, cu atât e mai probabil să devină clienți.", query: { metric: "pending_requests" }, drillTitle: "Cereri de programare noi" });
  if (a.unused_packages_idle)
    actions.push({ severity: "medium", count: a.unused_packages_idle, text: "Clienți cu ședințe din pachet nefolosite și nicio programare", detail: `${a.unused_package_sessions} ședințe plătite așteaptă în total. Merită un telefon.`, query: { metric: "unused_packages" }, drillTitle: "Pachete cu ședințe rămase" });
  if (a.at_risk_clients)
    actions.push({ severity: "low", count: a.at_risk_clients, text: "Clienți fideli care nu au mai revenit", detail: "Au cel puțin 2 vizite, dar niciuna în ultimele 45 de zile și nimic programat.", query: { metric: "at_risk" }, drillTitle: "Clienți care nu au mai revenit" });
  return actions;
}

const DOT = { high: "bg-[var(--mm-danger)]", medium: "bg-[var(--mm-warning)]", low: "bg-zinc-400" };

/**
 * "De rezolvat acum": what needs someone's attention today — unfinished visits,
 * money owed, unanswered requests… Each item opens the list of people behind it.
 * Shared by the board and the insights page.
 */
export function AttentionList({
  attention,
  extra = [],
  description = "Apasă ca să vezi pe cine privește.",
  columns = 2,
}: {
  attention: Attention;
  /** Page-specific items shown first (e.g. accounts waiting for approval). */
  extra?: { key: string; node: React.ReactNode }[];
  description?: string;
  columns?: 1 | 2;
}) {
  const actions = buildActions(attention);
  if (!actions.length && !extra.length) {
    return (
      <section className="mm-card flex items-center gap-3 p-5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--mm-success)]" />
        <p className="text-sm text-zinc-700">
          <span className="font-semibold">Totul e la zi.</span> Nicio plată restantă, programare nefinalizată sau cerere fără
          răspuns.
        </p>
      </section>
    );
  }
  return (
    <section className="mm-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
        <AlertTriangle className="h-5 w-5 text-[var(--mm-warning)]" />
        De rezolvat acum
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <ul className={`mt-3 grid gap-2 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
        {extra.map((item) => (
          <li key={item.key}>{item.node}</li>
        ))}
        {actions.map((a) => (
          <li key={a.text}>
            <Drill
              query={a.query}
              title={a.drillTitle}
              description={a.detail}
              className="group flex h-full w-full items-start gap-3 rounded-[var(--mm-radius-md)] border border-[var(--mm-border)] px-3 py-3 hover:bg-zinc-50"
            >
              <AttentionRow severity={a.severity} count={a.count} text={a.text} detail={a.detail} />
            </Drill>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One row's content; also used for page-specific links in `extra`. */
export function AttentionRow({ severity, count, text, detail }: Pick<Action, "severity" | "count" | "text" | "detail">) {
  return (
    <>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[severity]}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-900">
          <span className="mm-numeric">{count}</span> · {text}
        </span>
        {detail && <span className="block text-xs text-zinc-500">{detail}</span>}
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" />
    </>
  );
}
