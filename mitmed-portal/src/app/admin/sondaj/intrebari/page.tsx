import Link from "next/link";
import { getSurveySettings, listSurveyQuestions } from "@/actions/surveys";
import { SurveySettingsForm, QuestionList, NewQuestionForm } from "./SurveyEditor";

export default async function SurveyQuestionsPage() {
  const [settings, questions] = await Promise.all([getSurveySettings(), listSurveyQuestions()]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Sondaj de opinie</h1>
          <p className="text-sm text-zinc-500">
            Întrebările pe care clienții le primesc în cont după o vizită și linkul spre recenziile de pe Google Maps.
          </p>
        </div>
        <Link href="/admin/sondaj" className="mm-btn" data-variant="secondary">Vezi rezultatele</Link>
      </div>
      <SurveySettingsForm settings={settings} />
      <QuestionList questions={questions.filter((q) => !q.archived)} archived={questions.filter((q) => q.archived)} />
      <NewQuestionForm />
    </div>
  );
}
