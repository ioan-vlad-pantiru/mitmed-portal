"use client";

import { useActionState, useState, useTransition } from "react";
import { updateConsentTemplate, toggleConsentTemplateActive, type ConsentType } from "@/actions/consents";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/Toast";

export function TemplateForm({
  type,
  initialLabel,
  initialText,
  active,
}: {
  type: ConsentType;
  initialLabel: string;
  initialText: string;
  active: boolean;
}) {
  const boundAction = updateConsentTemplate.bind(null, type);
  const [state, action, pending] = useActionState(boundAction, undefined);
  const [label, setLabel] = useState(initialLabel);
  const [text, setText] = useState(initialText);
  const [togglePending, startToggle] = useTransition();
  const toast = useToast();
  const today = new Date().toLocaleDateString("ro-RO");

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <form action={action} className="space-y-3 mm-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Input
            name="label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 font-medium"
            placeholder="Nume document"
          />
          <Badge variant={active ? "success" : "neutral"}>{active ? "Activ" : "Dezactivat"}</Badge>
        </div>
        <Textarea name="text" required rows={9} value={text} onChange={(e) => setText(e.target.value)} />
        {state?.message && (
          <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Se salvează…" : "Salvează"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={togglePending}
            onClick={() =>
              startToggle(async () => {
                try {
                  await toggleConsentTemplateActive(type, !active);
                  toast.success(active ? "Document dezactivat." : "Document activat.");
                } catch {
                  toast.error("Nu am putut schimba statusul. Încearcă din nou.");
                }
              })
            }
          >
            {active ? "Dezactivează" : "Activează"}
          </Button>
        </div>
        {!active && (
          <p className="text-xs text-zinc-400">
            Dezactivat — nu mai apare clienților în portal ca document de semnat, dar declarațiile deja semnate rămân
            neschimbate în fișele lor.
          </p>
        )}
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
          <h2 className="mt-3 font-[family-name:var(--font-editorial)] text-xl italic text-zinc-900">
            {label || <span className="text-zinc-300">Nume document…</span>}
          </h2>
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
