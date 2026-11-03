"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/apiClient";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

export type SurveyQuestionKind = "rating" | "choice" | "multi" | "text";

export type SurveyQuestion = {
  id: string;
  label: string;
  kind: SurveyQuestionKind;
  options: string[];
  required: boolean;
  position: number;
  archived: boolean;
};

export type SurveyAnswer = number | string | string[];

export type OwnSurvey = {
  enabled: boolean;
  questions: SurveyQuestion[];
  pending: { appointment_id: string; starts_at: string; therapy_name: string } | null;
  answered_count: number;
  google_review_url: string | null;
};

export type SurveySettings = { enabled: boolean; google_review_url: string | null };

export type SurveyResults = {
  total_responses: number;
  average_rating: number | null;
  satisfied_share: number | null;
  responses_this_month: number;
  monthly: { month: string; responses: number; average: number | null }[];
  questions: (SurveyQuestion & {
    answered: number;
    average?: number | null;
    distribution?: { label: string; count: number }[];
    texts?: { text: string; created_at: string; client_name: string }[];
  })[];
  responses: {
    id: string;
    created_at: string;
    client: { id: string; full_name: string };
    appointment: { starts_at: string; therapy_name: string } | null;
    average: number | null;
    answers: Record<string, SurveyAnswer>;
  }[];
};

export type SurveyFormState = { message?: string; success?: boolean } | undefined;

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  throw err;
}

// --- Client -------------------------------------------------------------------

export async function getOwnSurvey(): Promise<OwnSurvey | null> {
  try {
    return await apiGet<OwnSurvey>("/survey/me");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return null;
    throw err;
  }
}

export type SubmitSurveyState =
  | { message?: string; success?: false }
  | { success: true; googleReviewUrl: string | null }
  | undefined;

export async function submitOwnSurvey(_state: SubmitSurveyState, formData: FormData): Promise<SubmitSurveyState> {
  await requireRole(Role.CLIENT);
  let answers: Record<string, SurveyAnswer> = {};
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { message: "Răspunsurile nu au putut fi citite. Reîncearcă." };
  }
  try {
    const result = await apiPost<{ ok: true; google_review_url: string | null }>("/survey/me", {
      appointment_id: String(formData.get("appointmentId") ?? ""),
      answers,
    });
    revalidatePath("/portal");
    return { success: true, googleReviewUrl: result.google_review_url };
  } catch (err) {
    return { message: errorMessage(err) };
  }
}

// --- Admin ------------------------------------------------------------------------

export async function getSurveyResults(): Promise<SurveyResults> {
  await requireRole(Role.ADMIN);
  return apiGet<SurveyResults>("/survey/results");
}

export async function listSurveyQuestions(): Promise<SurveyQuestion[]> {
  await requireRole(Role.ADMIN);
  return apiGet<SurveyQuestion[]>("/survey/questions");
}

export async function getSurveySettings(): Promise<SurveySettings> {
  await requireRole(Role.ADMIN);
  return apiGet<SurveySettings>("/survey/settings");
}

function questionPayload(formData: FormData) {
  return {
    label: String(formData.get("label") ?? ""),
    kind: String(formData.get("kind") ?? "rating"),
    options: String(formData.get("options") ?? "").split("\n").map((o) => o.trim()).filter(Boolean),
    required: formData.get("required") === "on",
  };
}

function revalidateSurvey() {
  revalidatePath("/admin/sondaj");
  revalidatePath("/admin/sondaj/intrebari");
}

export async function createSurveyQuestion(_state: SurveyFormState, formData: FormData): Promise<SurveyFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPost("/survey/questions", questionPayload(formData));
  } catch (err) {
    return { message: errorMessage(err) };
  }
  revalidateSurvey();
  return { success: true, message: "Întrebarea a fost adăugată." };
}

export async function updateSurveyQuestion(
  questionId: string,
  _state: SurveyFormState,
  formData: FormData
): Promise<SurveyFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut(`/survey/questions/${encodeURIComponent(questionId)}`, questionPayload(formData));
  } catch (err) {
    return { message: errorMessage(err) };
  }
  revalidateSurvey();
  return { success: true, message: "Întrebarea a fost salvată." };
}

export async function deleteSurveyQuestion(questionId: string): Promise<{ ok: true; outcome: string } | { ok: false; message: string }> {
  await requireRole(Role.ADMIN);
  try {
    const result = await apiDelete<{ outcome: string }>(`/survey/questions/${encodeURIComponent(questionId)}`);
    revalidateSurvey();
    return { ok: true, outcome: result.outcome };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

export async function restoreSurveyQuestion(questionId: string): Promise<void> {
  await requireRole(Role.ADMIN);
  await apiPost(`/survey/questions/${encodeURIComponent(questionId)}/restore`);
  revalidateSurvey();
}

export async function moveSurveyQuestion(questionId: string, direction: "up" | "down"): Promise<void> {
  await requireRole(Role.ADMIN);
  await apiPost(`/survey/questions/${encodeURIComponent(questionId)}/move`, { direction });
  revalidateSurvey();
}

export async function updateSurveySettings(_state: SurveyFormState, formData: FormData): Promise<SurveyFormState> {
  await requireRole(Role.ADMIN);
  try {
    await apiPut("/survey/settings", {
      enabled: formData.get("enabled") === "on",
      google_review_url: String(formData.get("googleReviewUrl") ?? "").trim() || null,
    });
  } catch (err) {
    return { message: errorMessage(err) };
  }
  revalidateSurvey();
  return { success: true, message: "Setările sondajului au fost salvate." };
}
