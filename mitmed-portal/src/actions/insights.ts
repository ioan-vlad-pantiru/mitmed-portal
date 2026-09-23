"use server";

import { apiGet } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type TherapyInsight = {
  id: string;
  name: string;
  active: boolean;
  sessions_completed: number;
  distinct_clients: number;
  revenue: string;
};

export type OverallInsights = {
  revenue_this_month: string;
  outstanding: string;
  new_clients_this_month: number;
  completed_sessions_this_month: number;
  cancelled_sessions_this_month: number;
  returning_clients: number;
  clients_with_completed_sessions: number;
  monthly_revenue: { month: string; revenue: string }[];
};

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

/** Performanța fiecărei terapii — ședințe finalizate, clienți unici, venit încasat. */
export async function getTherapyInsights(): Promise<TherapyInsight[]> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<TherapyInsight[]>("/insights/therapies");
}

/** Statistici de ansamblu pentru bordul admin. */
export async function getOverallInsights(): Promise<OverallInsights> {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  return apiGet<OverallInsights>("/insights/overall");
}

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
