"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type SiteAnnouncement = {
  enabled: boolean;
  text: string;
  mobile_text: string | null;
  updated_at: string;
};

export type AnnouncementFormState = { message?: string; success?: boolean } | undefined;

export async function getSiteAnnouncement(): Promise<SiteAnnouncement> {
  await requireRole(Role.ADMIN);
  return apiGet<SiteAnnouncement>("/site/announcement");
}

export async function updateSiteAnnouncement(
  _state: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut("/site/announcement", {
      enabled: formData.get("enabled") === "on",
      text: String(formData.get("text") ?? ""),
      mobile_text: String(formData.get("mobileText") ?? "").trim() || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { message: err.message };
    throw err;
  }
  revalidatePath("/admin/site");
  return { success: true, message: "Salvat — modificarea apare imediat pe mitmed.ro." };
}
