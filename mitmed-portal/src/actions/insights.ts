"use server";

import { apiGet } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type Distribution = { label: string; count: number };

export type OutstandingPayment = {
  id: string;
  client_id: string;
  client_name: string;
  therapy_name: string;
  final_price: string;
  amount_paid: string;
  remaining: string;
  paid_via_payu: boolean;
  status: "NEPLATIT" | "PARTIAL";
  created_at: string;
};

export type ClientInsights = {
  total_clients: number;
  profiles_completed: number;
  age_groups: Distribution[];
  cities: Distribution[];
  referral_sources: Distribution[];
  activity_levels: Distribution[];
  primary_goals: Distribution[];
  interests: Distribution[];
  occupation_categories: Distribution[];
};

/** Distribuții anonimizate ale datelor de profil completate de clienți. */
export async function getClientInsights(): Promise<ClientInsights> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<ClientInsights>("/insights/clients");
}

/** Detaliu al sumelor neîncasate — cine anume nu a plătit. */
export async function getOutstandingPayments(): Promise<OutstandingPayment[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<OutstandingPayment[]>("/insights/outstanding");
}

// --- Period report (Zi / Lună / An / Tot) -------------------------------------------

export type ReportScope = "day" | "month" | "year" | "all";

export type ReportSummary = {
  revenue: number;
  sessions: number;
  cancelled: number;
  cancellation_rate: number | null;
  booked_ahead: number;
  avg_per_visit: number | null;
  new_clients: number;
  active_clients: number;
  returning_clients: number;
  first_time_clients: number;
  return_rate: number | null;
  discounts: number;
  packages_sold: number;
  rating_average: number | null;
  rating_count: number;
  satisfied_share: number | null;
  booking_requests: number;
  booking_requests_confirmed: number;
};

export type ReportBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
  weekend: boolean;
  future: boolean;
  revenue: number;
  sessions: number;
  cancelled: number;
};

export type ReportTherapy = {
  id: string;
  name: string;
  active: boolean;
  revenue: number;
  prev_revenue: number;
  share: number;
  sessions: number;
  prev_sessions: number;
  cancelled: number;
  cancellation_rate: number | null;
  clients: number;
  avg_per_session: number | null;
};

export type InsightsReport = {
  period: {
    scope: ReportScope;
    anchor: string;
    start: string;
    end: string;
    prev_start: string | null;
    prev_end: string | null;
    label: string;
    compare_label: string | null;
    is_current: boolean;
    prev_anchor: string | null;
    next_anchor: string | null;
  };
  current: ReportSummary;
  previous: ReportSummary | null;
  series: { unit: "hour" | "day" | "month" | "year"; buckets: ReportBucket[] };
  therapies: ReportTherapy[];
  heatmap: {
    hours: number[];
    cells: { weekday: number; hour: number; count: number }[];
    by_weekday: number[];
    by_hour: { hour: number; count: number }[];
  };
  methods: { cash: number; card: number; online: number; other: number };
  top_clients: { client_id: string; client_name: string; revenue: number; visits: number }[];
  coupons: { id: string; code: string; uses: number; discount: number; revenue: number }[];
  new_client_sources: Distribution[];
  attention: {
    outstanding_total: number;
    outstanding_count: number;
    outstanding_clients: number;
    outstanding_aging: { under_30: number; d30_90: number; over_90: number };
    at_risk_clients: number;
    unused_packages_clients: number;
    unused_packages_idle: number;
    unused_package_sessions: number;
    stale_unfinished: number;
    pending_booking_requests: number;
  };
};

export type DrillQuery = {
  metric: string;
  scope?: ReportScope;
  date?: string;
  start?: string;
  end?: string;
  therapy_id?: string;
  weekday?: number;
  hour?: number;
  method?: string;
  coupon_id?: string;
};

export type DrillRow = {
  key: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  subtitle: string | null;
  date: string | null;
  amount: number | null;
  badge: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" } | null;
  href: string | null;
};

/** Everything the insights page shows for one period, plus the previous period. */
export async function getInsightsReport(scope: ReportScope, date?: string): Promise<InsightsReport> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<InsightsReport>("/insights/report", { scope, date });
}

/** The individual rows behind one number on the insights page. */
export async function getInsightsDrilldown(query: DrillQuery): Promise<DrillRow[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<DrillRow[]>("/insights/drilldown", query);
}
