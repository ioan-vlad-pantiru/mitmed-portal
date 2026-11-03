import Link from "next/link";
import { getSurveyResults, type SurveyAnswer, type SurveyResults } from "@/actions/surveys";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { CLINIC_TIME_ZONE } from "@/lib/clinic";

const MONTHS = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: 1 }));
const day = (iso: string) => new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric", timeZone: CLINIC_TIME_ZONE });

export default async function SurveyResultsPage() {
  await requireRole(Role.ADMIN);
  const results = await getSurveyResults();
  const labels = Object.fromEntries(results.questions.map((q) => [q.id, q]));
  const maxMonthly = Math.max(1, ...results.monthly.map((m) => m.responses));

  const kpis = [
    { value: results.average_rating == null ? "—" : `${fmt(results.average_rating)} / 5`, label: "Nota medie" },
    { value: results.satisfied_share == null ? "—" : `${results.satisfied_share}%`, label: "Clienți mulțumiți (nota 4-5)" },
    { value: results.total_responses, label: "Răspunsuri în total" },
    { value: results.responses_this_month, label: "Răspunsuri luna aceasta" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Satisfacția clienților</h1>
          <p className="text-sm text-zinc-500">Ce au răspuns clienții la sondajul din contul lor, după vizită.</p>
        </div>
        <Link href="/admin/sondaj/intrebari" className="mm-btn" data-variant="secondary">Editează întrebările</Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="mm-card p-4">
            <p className="mm-numeric text-2xl font-bold text-zinc-900">{k.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{k.label}</p>
          </div>
        ))}
      </section>

      {results.total_responses === 0 ? (
        <p className="mm-card p-6 text-sm text-zinc-500">
          Niciun răspuns încă. Clienții văd sondajul în contul lor după o vizită finalizată.
        </p>
      ) : (
        <>
          <section className="mm-card p-4">
            <h2 className="text-sm font-semibold text-zinc-800">Ultimele 6 luni</h2>
            <div className="mt-4 grid grid-cols-6 items-end gap-2">
              {results.monthly.map((m) => (
                <div key={m.month} className="flex flex-col items-center gap-1 text-center">
                  <span className="mm-numeric text-xs font-semibold text-zinc-700">{m.average == null ? "—" : `${fmt(m.average)}★`}</span>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div className="w-full max-w-10 rounded-t bg-[var(--mitmed-teal)]" style={{ height: `${Math.max(m.responses ? 6 : 0, (m.responses / maxMonthly) * 100)}%` }} title={`${m.responses} răspunsuri`} />
                  </div>
                  <span className="text-xs text-zinc-500">{MONTHS[Number(m.month.slice(5)) - 1]}</span>
                  <span className="mm-numeric text-[11px] text-zinc-400">{m.responses}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Pe întrebări</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {results.questions.filter((q) => q.answered > 0 || !q.archived).map((q) => <QuestionPanel key={q.id} question={q} />)}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Toate răspunsurile</h2>
            <div className="mt-3 space-y-3">
              {results.responses.map((r) => (
                <details key={r.id} className="mm-card p-4">
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <Link href={`/admin/clienti/${r.client.id}`} className="font-semibold text-zinc-900 hover:underline">{r.client.full_name}</Link>
                      <span className="ml-2 text-sm text-zinc-500">
                        {day(r.created_at)}{r.appointment ? ` · ${r.appointment.therapy_name}` : ""}
                      </span>
                    </span>
                    <span className="mm-numeric text-sm font-semibold text-zinc-700">{r.average == null ? "" : `${fmt(r.average)} ★`}</span>
                  </summary>
                  <dl className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm">
                    {Object.entries(r.answers).map(([qid, value]) => (
                      <div key={qid}>
                        <dt className="text-xs font-medium text-zinc-500">{labels[qid]?.label ?? "Întrebare ștearsă"}</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-zinc-800">{formatAnswer(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function formatAnswer(value: SurveyAnswer): string {
  if (typeof value === "number") return `${"★".repeat(value)}${"☆".repeat(5 - value)} (${value}/5)`;
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function QuestionPanel({ question: q }: { question: SurveyResults["questions"][number] }) {
  const max = Math.max(1, ...(q.distribution ?? []).map((d) => d.count));
  return (
    <div className="mm-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-800">
          {q.label}
          {q.archived && <span className="ml-2 text-xs font-normal text-zinc-400">(ștearsă)</span>}
        </h3>
        {q.kind === "rating" && <span className="mm-numeric shrink-0 text-sm font-bold text-zinc-900">{fmt(q.average)} ★</span>}
      </div>
      <p className="mt-0.5 text-xs text-zinc-400">{q.answered} răspunsuri</p>
      {q.distribution && (
        <div className="mt-3 space-y-2">
          {q.distribution.map((d) => (
            <div key={d.label}>
              <div className="flex justify-between gap-3 text-xs text-zinc-600">
                <span>{q.kind === "rating" ? `${d.label} ★` : d.label}</span>
                <span className="mm-numeric font-semibold text-zinc-800">{d.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-[var(--mitmed-teal)]" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {q.texts && (
        q.texts.length ? (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {q.texts.map((t, i) => (
              <li key={i} className="rounded-lg bg-zinc-50 p-2.5 text-sm text-zinc-700">
                <p className="whitespace-pre-line">{t.text}</p>
                <p className="mt-1 text-xs text-zinc-400">{t.client_name} · {day(t.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-zinc-400">Niciun comentariu încă.</p>
      )}
    </div>
  );
}
