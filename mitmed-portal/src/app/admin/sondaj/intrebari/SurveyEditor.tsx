"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  createSurveyQuestion,
  deleteSurveyQuestion,
  moveSurveyQuestion,
  restoreSurveyQuestion,
  updateSurveyQuestion,
  updateSurveySettings,
  type SurveyQuestion,
  type SurveyQuestionKind,
  type SurveySettings,
} from "@/actions/surveys";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";

const KIND_LABELS: Record<SurveyQuestionKind, string> = {
  rating: "Notă cu stele (1-5)",
  choice: "O singură variantă",
  multi: "Mai multe variante",
  text: "Răspuns liber (text)",
};

function useSuccessToast(state: { success?: boolean; message?: string } | undefined, onSuccess?: () => void) {
  const toast = useToast();
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Salvat.");
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function SurveySettingsForm({ settings }: { settings: SurveySettings }) {
  const [state, action, pending] = useActionState(updateSurveySettings, undefined);
  useSuccessToast(state);
  return (
    <form action={action} className="mm-card max-w-3xl space-y-4 p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
        Sondajul este activ (clienții îl văd în cont după o vizită finalizată)
      </label>
      <div>
        <label htmlFor="google-review-url" className="block text-xs font-medium text-zinc-700">Link recenzii Google Maps</label>
        <Input
          id="google-review-url"
          name="googleReviewUrl"
          type="url"
          defaultValue={settings.google_review_url ?? ""}
          placeholder="https://g.page/r/…/review"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Îl găsești în Google Business Profile → „Cere recenzii”. Apare tuturor clienților după ce trimit sondajul. Gol = nu se arată.
        </p>
      </div>
      {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează"}</Button>
    </form>
  );
}

export function QuestionList({ questions, archived }: { questions: SurveyQuestion[]; archived: SurveyQuestion[] }) {
  return (
    <section className="max-w-3xl space-y-3">
      <h2 className="text-base font-semibold text-zinc-900">Întrebări ({questions.length})</h2>
      {questions.length === 0 && <p className="mm-card p-4 text-sm text-zinc-500">Nicio întrebare — clienții nu vor vedea sondajul până nu adaugi una.</p>}
      {questions.map((q, i) => <QuestionRow key={q.id} question={q} isFirst={i === 0} isLast={i === questions.length - 1} />)}
      {archived.length > 0 && (
        <details className="mm-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600">Întrebări șterse ({archived.length}) — răspunsurile lor rămân în rezultate</summary>
          <ul className="mt-3 space-y-2">
            {archived.map((q) => <ArchivedRow key={q.id} question={q} />)}
          </ul>
        </details>
      )}
    </section>
  );
}

function QuestionRow({ question: q, isFirst, isLast }: { question: SurveyQuestion; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, startTransition] = useTransition();
  const toast = useToast();

  if (editing) return <QuestionForm question={q} onDone={() => setEditing(false)} />;

  return (
    <div className="mm-card flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900">
          {q.label}
          {q.required && <span className="ml-1 text-red-600" title="Obligatorie">*</span>}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {KIND_LABELS[q.kind]}{q.options.length > 0 && ` · ${q.options.join(" / ")}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Mută mai sus" disabled={isFirst || busy} onClick={() => startTransition(() => moveSurveyQuestion(q.id, "up"))}><ArrowUp size={15} /></IconButton>
        <IconButton label="Mută mai jos" disabled={isLast || busy} onClick={() => startTransition(() => moveSurveyQuestion(q.id, "down"))}><ArrowDown size={15} /></IconButton>
        <IconButton label="Editează" disabled={busy} onClick={() => setEditing(true)}><Pencil size={15} /></IconButton>
        <IconButton
          label="Șterge"
          disabled={busy}
          onClick={() => startTransition(async () => {
            const result = await deleteSurveyQuestion(q.id);
            if (!result.ok) toast.error(result.message);
            else toast.success(result.outcome === "archived" ? "Întrebarea a fost scoasă din sondaj; răspunsurile vechi rămân." : "Întrebarea a fost ștearsă.");
          })}
        ><Trash2 size={15} /></IconButton>
      </div>
    </div>
  );
}

function ArchivedRow({ question: q }: { question: SurveyQuestion }) {
  const [busy, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 text-sm text-zinc-600">
      <span>{q.label}</span>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => startTransition(() => restoreSurveyQuestion(q.id))}>
        <RotateCcw size={14} className="mr-1" /> Readaugă
      </Button>
    </li>
  );
}

function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}

export function NewQuestionForm() {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="secondary" onClick={() => setOpen(true)}>+ Adaugă o întrebare</Button>;
  return <QuestionForm onDone={() => setOpen(false)} />;
}

function QuestionForm({ question, onDone }: { question?: SurveyQuestion; onDone: () => void }) {
  const save = question ? updateSurveyQuestion.bind(null, question.id) : createSurveyQuestion;
  const [state, action, pending] = useActionState(save, undefined);
  const [kind, setKind] = useState<SurveyQuestionKind>(question?.kind ?? "rating");
  useSuccessToast(state, onDone);
  const hasOptions = kind === "choice" || kind === "multi";

  return (
    <form action={action} className="mm-card max-w-3xl space-y-3 border-[var(--mitmed-teal)]/30 p-4">
      <div>
        <label htmlFor={`q-label-${question?.id ?? "new"}`} className="block text-xs font-medium text-zinc-700">Întrebarea</label>
        <Input id={`q-label-${question?.id ?? "new"}`} name="label" required maxLength={200} defaultValue={question?.label} placeholder="Ex: Cum ți s-a părut experiența cu terapeutul?" className="mt-1" autoFocus />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`q-kind-${question?.id ?? "new"}`} className="block text-xs font-medium text-zinc-700">Tip de răspuns</label>
          <Select id={`q-kind-${question?.id ?? "new"}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as SurveyQuestionKind)} className="mt-1">
            {(Object.keys(KIND_LABELS) as SurveyQuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700">
          <input type="checkbox" name="required" defaultChecked={question?.required} /> Obligatorie
        </label>
      </div>
      {hasOptions && (
        <div>
          <label htmlFor={`q-options-${question?.id ?? "new"}`} className="block text-xs font-medium text-zinc-700">Variante de răspuns (câte una pe rând)</label>
          <Textarea id={`q-options-${question?.id ?? "new"}`} name="options" rows={4} defaultValue={question?.options.join("\n")} placeholder={"Da\nPoate\nNu"} className="mt-1" />
        </div>
      )}
      {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : question ? "Salvează" : "Adaugă întrebarea"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Renunță</Button>
      </div>
    </form>
  );
}
