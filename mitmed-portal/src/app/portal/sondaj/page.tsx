import { MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";
import { getOwnSurvey } from "@/actions/surveys";
import { CLINIC_TIME_ZONE } from "@/lib/clinic";
import { SurveyForm, SurveyThanks } from "./SurveyForm";

export default async function SurveyPage() {
  const survey = await getOwnSurvey();
  if (!survey) notFound();
  const pending = survey.pending;

  return (
    <div className="portal-subpage">
      <header>
        <p>Părerea ta</p>
        <h1>Cum ți s-a părut experiența la MitMed?</h1>
        <span>Durează un minut. Ne ajută să facem fiecare vizită mai bună.</span>
      </header>
      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <MessageSquareText />
          <div>
            <h2>Sondaj de satisfacție</h2>
            {pending && (
              <span className="portal-panel-caption">
                Despre vizita din {new Date(pending.starts_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", timeZone: CLINIC_TIME_ZONE })} · {pending.therapy_name}
              </span>
            )}
          </div>
        </div>
        {!survey.enabled ? (
          <p className="portal-quiet">Sondajul nu este disponibil momentan.</p>
        ) : pending ? (
          <SurveyForm appointmentId={pending.appointment_id} questions={survey.questions} />
        ) : survey.answered_count > 0 ? (
          <SurveyThanks googleReviewUrl={survey.google_review_url} />
        ) : (
          <p className="portal-quiet">Te vom întreba aici despre experiența ta după prima vizită încheiată.</p>
        )}
      </section>
    </div>
  );
}
