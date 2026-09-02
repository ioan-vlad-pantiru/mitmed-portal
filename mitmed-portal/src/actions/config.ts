"use server";

import { apiGet } from "@/lib/apiClient";

export async function getPublicConfig() {
  return apiGet<{ google_review_url: string | null }>("/config/public");
}
