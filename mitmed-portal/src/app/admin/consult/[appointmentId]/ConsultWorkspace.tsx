"use client";

import { useActionState, useState } from "react";
import { ClipboardList, Save } from "lucide-react";
import { createConsultationSheet, type ConsultationSheetField, type SheetTemplate } from "@/actions/consultationSheets";
import { TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import { AddSheetFieldInline, SheetFieldInputs } from "@/components/SheetFields";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConsultForm } from "./ConsultForm";

type ConsultFormProps = Parameters<typeof ConsultForm>[0];

/** Ecranul de Consult cu alegerea fișei: notițele de tratament ale ședinței
 * (implicit) sau oricare fișă din Setări → Fișe medicale (consultație ori o
 * fișă construită de admin). Orice fișă salvată de aici finalizează ședința. */
export function ConsultWorkspace({
  templates,
  fields,
  latestValues,
  defaultTemplateId,
  ...consultProps
}: ConsultFormProps & {
  templates: SheetTemplate[];
  /** Câmpurile active ale tuturor tipurilor de fișe. */
  fields: ConsultationSheetField[];
  latestValues: Record<string, Record<string, string>>;
  defaultTemplateId: string;
}) {
  const [selected, setSelected] = useState(defaultTemplateId);
  const template = templates.find((t) => t.id === selected);

  return (
    <div className="flex flex-col gap-4 sm:overflow-y-auto sm:pb-2 sm:pr-1">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <ClipboardList size={14} /> Ce fișă completezi?
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Fișa completată în consult">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected === t.id}
              onClick={() => setSelected(t.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selected === t.id
                  ? "border-[var(--mitmed-teal)] bg-[var(--mm-info-bg)] font-medium text-[var(--mitmed-teal-deep)]"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {t.kind === "tratament" ? `${t.name} (notițe ședință)` : t.name}
            </button>
          ))}
        </div>
      </div>

      {selected === TEMPLATE_TRATAMENT || !template ? (
        <ConsultForm {...consultProps} />
      ) : (
        <ConsultSheetForm
          key={template.id}
          template={template}
          fields={fields.filter((f) => f.template_id === template.id)}
          lastValues={latestValues[template.id] ?? {}}
          clientId={consultProps.clientId}
          appointmentId={consultProps.appointmentId}
          isAdmin={consultProps.isAdmin}
        />
      )}
    </div>
  );
}

function ConsultSheetForm({
  template,
  fields,
  lastValues,
  clientId,
  appointmentId,
  isAdmin,
}: {
  template: SheetTemplate;
  fields: ConsultationSheetField[];
  lastValues: Record<string, string>;
  clientId: string;
  appointmentId: string;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(createConsultationSheet.bind(null, clientId, template.id), undefined);
  // Câmpurile „precompletate” (ex. antecedente) pornesc de la ultima fișă de acest tip.
  const defaults = Object.fromEntries(fields.filter((f) => f.carry_over && lastValues[f.id]).map((f) => [f.id, lastValues[f.id]]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="fromConsult" value="1" />
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{template.name}</h2>
            {template.description && <p className="text-xs text-zinc-500">{template.description}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-zinc-700">
              Data
              <Input name="sheetDate" type="date" defaultValue={today} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Nr. fișă
              <Input name="sheetNumber" className="mt-1" />
            </label>
          </div>
          <SheetFieldInputs fields={fields} values={defaults} editable={isAdmin} />
          {fields.length === 0 && (
            <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">
              Fișa nu are încă nicio căsuță{isAdmin ? " — adaugă una mai jos." : "."}
            </p>
          )}
        </section>
        {state?.message && !state.success && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{state.message}</p>
        )}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 py-3 backdrop-blur">
          <span className="text-xs text-zinc-400">Fișa se salvează în dosarul pacientului.</span>
          <Button type="submit" disabled={pending}>
            {pending ? "Se salvează…" : <><Save size={16} /> Salvează fișa și finalizează ședința</>}
          </Button>
        </div>
      </form>
      {isAdmin && <AddSheetFieldInline templateId={template.id} />}
    </>
  );
}
