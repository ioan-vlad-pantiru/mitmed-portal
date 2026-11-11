"use client";

import { useActionState, useState } from "react";
import { Check, ClipboardList, FileText, Save } from "lucide-react";
import { createConsultationSheet, type ConsultationSheetField, type SheetTemplate } from "@/actions/consultationSheets";
import type { ConsultSavedSheet } from "@/actions/appointments";
import { TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import { AddSheetFieldInline, SheetFieldInputs } from "@/components/SheetFields";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConsultForm } from "./ConsultForm";
import { SavedSessionNotice } from "./SavedSessionNotice";
import { ConsultActionBar, ConsultSection } from "./ConsultSection";

type ConsultFormProps = Parameters<typeof ConsultForm>[0];

/** Ecranul de Consult cu alegerea fișei: notițele de tratament ale ședinței
 * (implicit) sau oricare fișă din Setări → Fișe medicale (consultație ori o
 * fișă construită de admin). Orice fișă salvată de aici finalizează ședința. */
export function ConsultWorkspace({
  templates,
  fields,
  latestValues,
  savedSheets,
  defaultTemplateId,
  ...consultProps
}: ConsultFormProps & {
  templates: SheetTemplate[];
  /** Câmpurile active ale tuturor tipurilor de fișe. */
  fields: ConsultationSheetField[];
  latestValues: Record<string, Record<string, string>>;
  /** Sheets already saved for this appointment, keyed by template. */
  savedSheets: Record<string, ConsultSavedSheet>;
  defaultTemplateId: string;
}) {
  const [selected, setSelected] = useState(defaultTemplateId);
  const template = templates.find((t) => t.id === selected);

  return (
    <div className="flex flex-col gap-4 sm:overflow-y-auto sm:pb-2 sm:pr-1">
      <div className="mm-card p-3 sm:px-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <ClipboardList size={14} aria-hidden /> Ce fișă completezi?
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Fișa completată în consult">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected === t.id}
              onClick={() => setSelected(t.id)}
              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                selected === t.id
                  ? "border-[var(--mitmed-teal)] bg-[var(--mitmed-teal)] font-medium text-white"
                  : "border-[var(--mm-border-strong)] bg-white text-zinc-600 hover:bg-[var(--mm-surface-muted)]"
              }`}
            >
              {t.kind === "tratament" ? `${t.name} (notițe ședință)` : t.name}
              {(t.kind === "tratament" ? consultProps.savedRecord : savedSheets[t.id]) && (
                <Check
                  size={14}
                  className={`ml-1.5 ${selected === t.id ? "text-white" : "text-[var(--mm-success)]"}`}
                  aria-label="salvată"
                />
              )}
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
          saved={savedSheets[template.id] ?? null}
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
  saved,
  clientId,
  appointmentId,
  isAdmin,
}: {
  template: SheetTemplate;
  fields: ConsultationSheetField[];
  lastValues: Record<string, string>;
  saved: ConsultSavedSheet | null;
  clientId: string;
  appointmentId: string;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(createConsultationSheet.bind(null, clientId, template.id), undefined);
  // A sheet already saved for the appointment reopens as is; otherwise carry-over
  // fields (e.g. medical history) start from the patient's last sheet of this type.
  const values = saved
    ? saved.values
    : Object.fromEntries(fields.filter((f) => f.carry_over && lastValues[f.id]).map((f) => [f.id, lastValues[f.id]]));
  const readOnly = saved !== null && !isAdmin;
  const sheetDate = (saved ? new Date(saved.sheet_date) : new Date()).toISOString().slice(0, 10);

  return (
    <>
      {saved && <SavedSessionNotice readOnly={readOnly} />}
      <form action={action} className="flex flex-col gap-4">
        <fieldset disabled={readOnly} className="contents">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="fromConsult" value="1" />
          <ConsultSection icon={FileText} title={template.name} hint={template.description ?? undefined}>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-zinc-700">
                  Data
                  <Input name="sheetDate" type="date" defaultValue={sheetDate} className="mt-1" />
                </label>
                <label className="block text-xs font-medium text-zinc-700">
                  Nr. fișă
                  <Input name="sheetNumber" defaultValue={saved?.sheet_number ?? ""} className="mt-1" />
                </label>
              </div>
              <SheetFieldInputs fields={fields} values={values} editable={isAdmin} />
              {fields.length === 0 && (
                <p className="mm-inset p-3 text-sm text-zinc-500">
                  Fișa nu are încă nicio căsuță
                  {isAdmin ? " — adaugă una mai jos." : "."}
                </p>
              )}
            </div>
          </ConsultSection>
        </fieldset>
        {state?.message && !state.success && (
          <p data-variant="danger" className="mm-alert" role="alert">
            {state.message}
          </p>
        )}
        <ConsultActionBar hint="Fișa se salvează în dosarul pacientului.">
          {!readOnly && (
            <Button type="submit" disabled={pending}>
              {pending ? (
                "Se salvează…"
              ) : (
                <>
                  <Save size={16} /> {saved ? "Salvează modificările" : "Salvează fișa și finalizează ședința"}
                </>
              )}
            </Button>
          )}
        </ConsultActionBar>
      </form>
      {isAdmin && <AddSheetFieldInline templateId={template.id} />}
    </>
  );
}
