"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Send, Star } from "lucide-react";
import { submitOwnSurvey, type SurveyAnswer, type SurveyQuestion } from "@/actions/surveys";

/** Formularul sondajului; după trimitere arată mulțumirea și linkul Google. */
export function SurveyForm({
  appointmentId,
  questions,
}: {
  appointmentId: string;
  questions: SurveyQuestion[];
}) {
  const [state, action, pending] = useActionState(submitOwnSurvey, undefined);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const set = (id: string, value: SurveyAnswer | undefined) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") delete next[id];
      else next[id] = value;
      return next;
    });

  if (state?.success) return <SurveyThanks googleReviewUrl={state.googleReviewUrl} />;

  return (
    <form action={action} className="medical-history-form">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      {questions.map((q, index) => (
        <fieldset key={q.id} className="medical-history-section survey-question">
          <legend>
            <span className="survey-question-number">{index + 1}</span>
            {q.label}
            {q.required && <span className="survey-required" aria-label="obligatoriu">*</span>}
          </legend>
          {q.kind === "rating" && (
            <StarRating label={q.label} value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : 0} onChange={(v) => set(q.id, v || undefined)} />
          )}
          {q.kind === "choice" && (
            <div className="survey-options" role="radiogroup" aria-label={q.label}>
              {q.options.map((option) => {
                const active = answers[q.id] === option;
                return (
                  <button key={option} type="button" role="radio" aria-checked={active} className="survey-option" data-active={active} onClick={() => set(q.id, active ? undefined : option)}>
                    {option}
                  </button>
                );
              })}
            </div>
          )}
          {q.kind === "multi" && (
            <div className="survey-options" role="group" aria-label={q.label}>
              <p className="survey-hint">Poți alege mai multe.</p>
              {q.options.map((option) => {
                const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                const active = current.includes(option);
                return (
                  <button key={option} type="button" aria-pressed={active} className="survey-option" data-active={active} onClick={() => set(q.id, active ? current.filter((o) => o !== option) : [...current, option])}>
                    {option}
                  </button>
                );
              })}
            </div>
          )}
          {q.kind === "text" && (
            <label className="medical-history-full">
              <span className="sr-only">{q.label}</span>
              <textarea rows={3} maxLength={2000} value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(e) => set(q.id, e.target.value)} placeholder="Scrie aici, dacă vrei…" />
            </label>
          )}
        </fieldset>
      ))}
      {state?.message && <p className="medical-history-result is-error" role="alert">{state.message}</p>}
      <div className="medical-history-actions">
        <p>Răspunsurile tale ajung doar la echipa MitMed și ne ajută să ne îmbunătățim.</p>
        <button type="submit" disabled={pending}>{pending ? "Se trimite…" : <><Send size={16} /> Trimite părerea</>}</button>
      </div>
    </form>
  );
}

function StarRating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const words = ["", "Foarte slab", "Slab", "Ok", "Bine", "Excelent"];
  return (
    <div className="survey-stars" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} din 5 — ${words[n]}`}
          className="survey-star"
          data-active={n <= shown}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          <Star size={30} />
        </button>
      ))}
      <span className="survey-star-word">{shown ? words[shown] : "Alege o notă"}</span>
    </div>
  );
}

export function SurveyThanks({ googleReviewUrl }: { googleReviewUrl: string | null }) {
  return (
    <div className="survey-thanks">
      <h2>Mulțumim pentru părere!</h2>
      <p>Echipa MitMed citește fiecare răspuns.</p>
      {googleReviewUrl && (
        <>
          <p>Dacă ai un minut, o recenzie pe Google Maps îi ajută și pe alții să ne găsească.</p>
          <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer" className="survey-google-link">
            Lasă o recenzie pe Google <ExternalLink size={15} />
          </a>
        </>
      )}
    </div>
  );
}
