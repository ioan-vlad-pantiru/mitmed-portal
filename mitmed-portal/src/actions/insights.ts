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
