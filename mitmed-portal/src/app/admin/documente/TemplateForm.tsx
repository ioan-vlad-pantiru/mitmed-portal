"use client";

import { useActionState, useState } from "react";
import { updateConsentTemplate, type ConsentType } from "@/actions/consents";

export function TemplateForm({
  type,
  title,
  initialText,
}: {
  type: ConsentType;
  title: string;
  initialText: string;
}) {
  const boundAction = updateConsentTemplate.bind(null, type);
  const [state, action, pending] = useActionState(boundAction, undefined);
  const [text, setText] = useState(initialText);
  const today = new Date().toLocaleDateString("ro-RO");

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <form action={action} className="space-y-3 mm-card p-4">
        <textarea
          name="text"
          required
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {state?.message && (
          <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Salvează"}
        </button>
      </form>

      {/* Preview live — exact cum va arăta documentul pe care îl semnează clientul
          (vezi antetul + fontul editorial din ConsentForm.tsx, portalul clientului). */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,24,0.04),0_12px_32px_-16px_rgba(0,63,64,0.2)]">
        <div className="border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold tracking-tight text-[var(--mitmed-teal)]">
              MitMed <span className="font-normal text-zinc-400">· Semarvion SRL</span>
            </span>
            <span className="text-xs text-zinc-400">{today}</span>
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-editorial)] text-xl italic text-zinc-900">{title}</h2>
        </div>
        <div className="px-6 py-6">
          <p className="whitespace-pre-wrap font-[family-name:var(--font-editorial)] text-[15px] leading-relaxed text-zinc-700">
            {text || <span className="italic text-zinc-300">Textul apare aici pe măsură ce scrii…</span>}
          </p>
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Semnătura</p>
          <div className="mt-4 max-w-sm border-b border-dashed border-zinc-300 pb-1 text-xs italic text-zinc-300">
            semnează aici ×
          </div>
          <div className="mt-2 flex max-w-sm justify-between text-xs text-zinc-400">
            <span>Nume client</span>
            <span>{today}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
