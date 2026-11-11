import type { DrillQuery, InsightsReport } from "@/actions/insights";
import { ron } from "./ui";

export type Verdict = { text: string; detail?: string; query: DrillQuery; drillTitle: string };

const pct = (v: number) => `${Math.round(Math.abs(v))}%`;
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

/**
 * Turns the report into plain sentences: what went well, what went worse,
 * each pointing at the list behind it. Only meaningful differences are
 * mentioned so the lists stay short.
 */
export function buildVerdicts(report: InsightsReport): { good: Verdict[]; bad: Verdict[] } {
  const { current: c, previous: p, period } = report;
  const base: DrillQuery = { metric: "", scope: period.scope, date: period.anchor };
  const good: Verdict[] = [];
  const bad: Verdict[] = [];
  const vs = period.compare_label ?? "";

  if (p) {
    const rev = change(c.revenue, p.revenue);
    if (rev !== null && rev >= 5)
      good.push({ text: `Încasările au crescut cu ${pct(rev)}`, detail: `${ron(c.revenue)} față de ${ron(p.revenue)}, ${vs}.`, query: { ...base, metric: "revenue" }, drillTitle: "Încasări" });
    if (rev !== null && rev <= -5)
      bad.push({ text: `Încasările au scăzut cu ${pct(rev)}`, detail: `${ron(c.revenue)} față de ${ron(p.revenue)}, ${vs}.`, query: { ...base, metric: "revenue" }, drillTitle: "Încasări" });

    const ses = change(c.sessions, p.sessions);
    if (ses !== null && ses >= 5)
      good.push({ text: `Mai multe ședințe: ${c.sessions} față de ${p.sessions}`, detail: `Cu ${pct(ses)} mai multe, ${vs}.`, query: { ...base, metric: "sessions" }, drillTitle: "Ședințe finalizate" });
    if (ses !== null && ses <= -5)
      bad.push({ text: `Mai puține ședințe: ${c.sessions} față de ${p.sessions}`, detail: `Cu ${pct(ses)} mai puține, ${vs}.`, query: { ...base, metric: "sessions" }, drillTitle: "Ședințe finalizate" });

    if (c.new_clients > p.new_clients && c.new_clients >= 2)
      good.push({ text: `${c.new_clients} clienți noi (înainte: ${p.new_clients})`, detail: "Vezi de unde au aflat de voi în tab-ul Clienți.", query: { ...base, metric: "new_clients" }, drillTitle: "Clienți noi" });
    if (p.new_clients >= 2 && c.new_clients < p.new_clients * 0.7)
      bad.push({ text: `Mai puțini clienți noi: ${c.new_clients} (înainte: ${p.new_clients})`, detail: "Merită verificat ce aduce clienți noi (Google, recomandări, rețele).", query: { ...base, metric: "new_clients" }, drillTitle: "Clienți noi" });

    if (c.avg_per_visit && p.avg_per_visit) {
      const avg = change(c.avg_per_visit, p.avg_per_visit)!;
      if (avg >= 8) good.push({ text: `Fiecare vizită aduce mai mult: ${ron(c.avg_per_visit)}`, detail: `Înainte: ${ron(p.avg_per_visit)} pe vizită.`, query: { ...base, metric: "revenue" }, drillTitle: "Încasări" });
      if (avg <= -8) bad.push({ text: `Fiecare vizită aduce mai puțin: ${ron(c.avg_per_visit)}`, detail: `Înainte: ${ron(p.avg_per_visit)}. Poate din reduceri sau pachete mai ieftine.`, query: { ...base, metric: "discounts" }, drillTitle: "Reduceri acordate" });
    }

    // Therapies that moved the most.
    const movers = report.therapies
      .filter((t) => t.prev_revenue > 0 || t.revenue > 0)
      .map((t) => ({ t, diff: t.revenue - t.prev_revenue }))
      .sort((a, b) => b.diff - a.diff);
    const up = movers[0];
    const down = movers[movers.length - 1];
    if (up && up.diff > 0 && up.t.prev_revenue > 0 && up.diff / up.t.prev_revenue >= 0.15)
      good.push({ text: `${up.t.name} merge mai bine`, detail: `+${ron(up.diff)} încasați față de perioada precedentă.`, query: { ...base, metric: "therapy", therapy_id: up.t.id }, drillTitle: up.t.name });
    if (down && down.diff < 0 && down.t.prev_revenue > 0 && -down.diff / down.t.prev_revenue >= 0.15)
      bad.push({ text: `${down.t.name} merge mai slab`, detail: `−${ron(-down.diff)} încasați față de perioada precedentă.`, query: { ...base, metric: "therapy", therapy_id: down.t.id }, drillTitle: down.t.name });
  }

  const finished = c.sessions + c.cancelled;
  if (c.cancellation_rate !== null && finished >= 5) {
    if (c.cancellation_rate >= 15)
      bad.push({ text: `${c.cancellation_rate.toLocaleString("ro-RO")}% din programări au fost anulate`, detail: `${c.cancelled} anulări. Peste 15% înseamnă ore pierdute — confirmările cu o zi înainte ajută.`, query: { ...base, metric: "cancelled" }, drillTitle: "Programări anulate" });
    else if (c.cancellation_rate <= 5)
      good.push({ text: `Foarte puține anulări (${c.cancellation_rate.toLocaleString("ro-RO")}%)`, detail: `Doar ${c.cancelled} din ${finished} programări.`, query: { ...base, metric: "cancelled" }, drillTitle: "Programări anulate" });
  }

  if (c.return_rate !== null && c.active_clients >= 5) {
    if (c.return_rate >= 60)
      good.push({ text: `${Math.round(c.return_rate)}% din clienți sunt clienți care revin`, detail: "Clienții se întorc — semn că tratamentul și experiența sunt bune.", query: { ...base, metric: "returning_clients" }, drillTitle: "Clienți care revin" });
    else if (c.return_rate < 30 && period.scope !== "day")
      bad.push({ text: `Doar ${Math.round(c.return_rate)}% din clienți au mai fost înainte`, detail: "Mulți vin o singură dată. Un pachet sau o programare de control pot ajuta.", query: { ...base, metric: "first_time_clients" }, drillTitle: "Clienți la prima vizită" });
  }

  if (c.rating_average !== null && c.rating_count >= 3) {
    if (c.rating_average >= 4.5)
      good.push({ text: `Clienții sunt mulțumiți: nota medie ${c.rating_average.toLocaleString("ro-RO")} / 5`, detail: `Din ${c.rating_count} răspunsuri la sondaj.`, query: { ...base, metric: "ratings" }, drillTitle: "Răspunsuri la sondaj" });
    else if (c.rating_average < 4)
      bad.push({ text: `Nota medie din sondaj e ${c.rating_average.toLocaleString("ro-RO")} / 5`, detail: "Citește răspunsurile cu note mici ca să vezi ce nu a mers.", query: { ...base, metric: "ratings" }, drillTitle: "Răspunsuri la sondaj" });
  }

  return { good, bad };
}
