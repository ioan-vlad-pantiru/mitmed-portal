import type { ReportScope } from "@/actions/insights";

/** URL of the insights page for a tab + period; shared by server and client code. */
export function insightsHref(tab: string, scope: ReportScope, date?: string | null) {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  params.set("scope", scope);
  if (date && scope !== "all") params.set("date", date);
  return `/admin/insights?${params.toString()}`;
}
