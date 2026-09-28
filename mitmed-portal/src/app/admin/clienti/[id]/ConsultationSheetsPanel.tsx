"use client";

import { useActionState, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import {
  createConsultationSheet,
  updateConsultationSheet,
  type ConsultationSheetField,
} from "@/actions/consultationSheets";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type ConsultationSheet = {
  id: string;
  sheet_date: string;
  sheet_number: string | null;
  values: Record<string, string>;
  author: { email: string } | null;
};

type PatientHeader = {
  full_name: string;
  cnp: string | null;
  birth_date: string | null;
  phone: string | null;
  gender?: string;
  address?: string;
  occupation?: string;
};

function ageFrom(birthDate: string | null): string {
  if (!birthDate) return "—";
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age -= 1;
  return `${age} ani`;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-700">{children}</label>;
}

type FieldBlock =
  | { kind: "section"; title: string; fields: ConsultationSheetField[] }
  | { kind: "short"; fields: ConsultationSheetField[] }
  | { kind: "long"; field: ConsultationSheetField };

/** Câmpurile consecutive din aceeași secțiune merg într-un chenar; câmpurile
 * scurte consecutive din afara secțiunilor se așază pe același rând. */
function toBlocks(fields: ConsultationSheetField[]): FieldBlock[] {
  const blocks: FieldBlock[] = [];
  for (const f of fields) {
    const last = blocks[blocks.length - 1];
    if (f.section) {
      if (last?.kind === "section" && last.title === f.section) last.fields.push(f);
      else blocks.push({ kind: "section", title: f.section, fields: [f] });
    } else if (f.field_type === "text") {
      if (last?.kind === "short") last.fields.push(f);
      else blocks.push({ kind: "short", fields: [f] });
    } else {
      blocks.push({ kind: "long", field: f });
    }
  }
  return blocks;
}

function FieldInput({ field, value }: { field: ConsultationSheetField; value: string }) {
  const id = `field-${field.id}`;
  const label = field.archived ? `${field.label} (câmp șters)` : field.label;
  const common = {
    id,
    name: `field:${field.id}`,
    defaultValue: value,
    placeholder: field.placeholder ?? undefined,
    className: "mt-1",
  };
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {field.field_type === "text" ? <Input {...common} /> : <Textarea {...common} rows={field.section ? 2 : 3} />}
    </div>
  );
}

function FieldGrid({ fields, values, wide }: { fields: ConsultationSheetField[]; values: Record<string, string>; wide?: boolean }) {
  return (
    <div className={`grid gap-3 ${wide ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3"}`}>
      {fields.map((f) => (
        <FieldInput key={f.id} field={f} value={values[f.id] ?? ""} />
      ))}
    </div>
  );
}

function SheetForm({
  clientId,
  sheet,
  fields,
  defaults,
  patient,
  onSaved,
}: {
  clientId: string;
  sheet: ConsultationSheet | null;
  fields: ConsultationSheetField[];
  defaults: Record<string, string>;
  patient: PatientHeader;
  onSaved: () => void;
}) {
  const save = async (prev: Parameters<typeof createConsultationSheet>[1], formData: FormData) => {
    const result = sheet
      ? await updateConsultationSheet(sheet.id, clientId, prev, formData)
      : await createConsultationSheet(clientId, prev, formData);
    if (result?.success) onSaved();
    return result;
  };
  const [state, action, pending] = useActionState(save, undefined);
  const values = sheet?.values ?? defaults;
  const today = new Date().toISOString().slice(0, 10);
  // Câmpurile șterse apar doar pe fișele unde au deja o valoare.
  const shown = fields.filter((f) => !f.archived || (sheet && sheet.values[f.id]));

  return (
    <form action={action} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
        <p className="font-medium text-zinc-900">{patient.full_name}</p>
        <p className="mt-0.5 text-xs">
          CNP: {patient.cnp ?? "—"} · Vârstă: {ageFrom(patient.birth_date)} · Sex: {patient.gender ? patient.gender.replaceAll("_", " ").toLowerCase() : "—"} · Tel: {patient.phone ?? "—"}
        </p>
        <p className="mt-0.5 text-xs">Domiciliu: {patient.address ?? "—"} · Ocupația: {patient.occupation ?? "—"}</p>
        <p className="mt-1 text-xs text-zinc-400">Se editează din „Datele pacientului”, deasupra listei de fișe.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="sheetDate">Data</Label>
          <Input id="sheetDate" name="sheetDate" type="date" defaultValue={(sheet?.sheet_date ?? today).slice(0, 10)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="sheetNumber">Nr. fișă</Label>
          <Input id="sheetNumber" name="sheetNumber" defaultValue={sheet?.sheet_number ?? ""} className="mt-1" />
        </div>
      </div>

      {toBlocks(shown).map((block, i) => {
        if (block.kind === "section") {
          return (
            <fieldset key={i} className="rounded-lg border border-zinc-100 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{block.title}</legend>
              <FieldGrid fields={block.fields} values={values} wide />
            </fieldset>
          );
        }
        if (block.kind === "short") return <FieldGrid key={i} fields={block.fields} values={values} />;
        return <FieldInput key={i} field={block.field} value={values[block.field.id] ?? ""} />;
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează fișa"}</Button>
        {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}

function sheetSummary(sheet: ConsultationSheet, fields: ConsultationSheetField[]): string {
  const short = fields
    .filter((f) => f.field_type === "text" && sheet.values[f.id])
    .map((f) => `${f.label} ${sheet.values[f.id]}`);
  if (short.length) return short.join(" · ");
  return fields.map((f) => sheet.values[f.id]).find(Boolean) ?? "Fișă necompletată";
}

/** Fișele de consultații și evaluări medicale ale pacientului (prima vizită și
 * reconsult), cu formularul cabinetului pentru creare și editare. */
export function ConsultationSheetsPanel({
  clientId,
  sheets,
  fields,
  patient,
}: {
  clientId: string;
  sheets: ConsultationSheet[];
  /** Toate câmpurile, inclusiv cele șterse (pentru fișele vechi). */
  fields: ConsultationSheetField[];
  patient: PatientHeader;
}) {
  // undefined = închis, null = fișă nouă, string = id-ul fișei editate.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const editedSheet = typeof editing === "string" ? sheets.find((s) => s.id === editing) ?? null : null;
  const latest = sheets[0];
  const defaults: Record<string, string> = {};
  if (latest) {
    for (const f of fields) {
      if (f.carry_over && !f.archived && latest.values[f.id]) defaults[f.id] = latest.values[f.id];
    }
  }

  return (
    <section className="mt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Fișe de consultație</h3>
        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
          <Plus size={14} className="mr-1 inline" />Fișă nouă
        </Button>
      </div>

      {sheets.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Nicio fișă de consultație încă.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {sheets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditing(s.id)}
              className="mm-card flex w-full items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">
                  {new Date(s.sheet_date).toLocaleDateString("ro-RO")}
                  {s.sheet_number ? ` · Nr. ${s.sheet_number}` : ""}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {sheetSummary(s, fields)}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-zinc-300" />
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => { if (!open) setEditing(undefined); }}
        title={editedSheet ? "Editează fișa de consultație" : "Fișă nouă de consultație"}
        description="Fișă consultații și evaluări medicale"
        size="lg"
      >
        {editing !== undefined && (
          <SheetForm
            key={editing ?? "new"}
            clientId={clientId}
            sheet={editedSheet}
            fields={fields}
            defaults={defaults}
            patient={patient}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Dialog>
    </section>
  );
}
