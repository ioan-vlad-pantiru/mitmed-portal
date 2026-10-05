"use client";

import { useActionState, useState, useTransition } from "react";
import { ChevronRight, Download, Plus } from "lucide-react";
import {
  createConsultationSheet,
  deleteConsultationSheet,
  updateConsultationSheet,
  type ConsultationSheetField,
  type SheetTemplate,
} from "@/actions/consultationSheets";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AddSheetFieldInline, SheetFieldInputs } from "@/components/SheetFields";
import { useToast } from "@/components/Toast";

export type ConsultationSheet = {
  id: string;
  template_id: string;
  sheet_date: string;
  sheet_number: string | null;
  values: Record<string, string>;
  author: { email: string } | null;
};

export type PatientHeader = {
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

export function PatientHeaderCard({ patient }: { patient: PatientHeader }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
      <p className="font-medium text-zinc-900">{patient.full_name}</p>
      <p className="mt-0.5 text-xs">
        CNP: {patient.cnp ?? "—"} · Vârstă: {ageFrom(patient.birth_date)} · Sex: {patient.gender ? patient.gender.replaceAll("_", " ").toLowerCase() : "—"} · Tel: {patient.phone ?? "—"}
      </p>
      <p className="mt-0.5 text-xs">Domiciliu: {patient.address ?? "—"} · Ocupația: {patient.occupation ?? "—"}</p>
      <p className="mt-1 text-xs text-zinc-400">Se editează din „Datele pacientului”, de la începutul dosarului.</p>
    </div>
  );
}

function SheetForm({
  clientId,
  template,
  sheet,
  fields,
  defaults,
  patient,
  isAdmin,
  onSaved,
}: {
  clientId: string;
  template: SheetTemplate;
  sheet: ConsultationSheet | null;
  fields: ConsultationSheetField[];
  defaults: Record<string, string>;
  patient: PatientHeader;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const save = async (prev: Parameters<typeof updateConsultationSheet>[2], formData: FormData) => {
    const result = sheet
      ? await updateConsultationSheet(sheet.id, clientId, prev, formData)
      : await createConsultationSheet(clientId, template.id, prev, formData);
    if (result?.success) onSaved();
    return result;
  };
  const [state, action, pending] = useActionState(save, undefined);
  const values = sheet?.values ?? defaults;
  const today = new Date().toISOString().slice(0, 10);
  // Câmpurile șterse apar doar pe fișele unde au deja o valoare.
  const shown = fields.filter((f) => !f.archived || (sheet && sheet.values[f.id]));
  // O fișă salvată se modifică doar de admin; recepția o vede read-only.
  const readOnly = Boolean(sheet) && !isAdmin;

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <form action={action} className="space-y-4">
        <PatientHeaderCard patient={patient} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="sheetDate" className="block text-xs font-medium text-zinc-700">Data</label>
            <Input id="sheetDate" name="sheetDate" type="date" readOnly={readOnly} defaultValue={(sheet?.sheet_date ?? today).slice(0, 10)} className="mt-1" />
          </div>
          <div>
            <label htmlFor="sheetNumber" className="block text-xs font-medium text-zinc-700">Nr. fișă</label>
            <Input id="sheetNumber" name="sheetNumber" readOnly={readOnly} defaultValue={sheet?.sheet_number ?? ""} className="mt-1" />
          </div>
        </div>

        <SheetFieldInputs fields={shown} values={values} editable={isAdmin} readOnly={readOnly} />
        {shown.length === 0 && (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">
            Fișa nu are încă nicio căsuță{isAdmin ? " — adaugă una mai jos." : "."}
          </p>
        )}

        {readOnly ? (
          <p className="text-xs text-zinc-500">Doar adminul poate modifica o fișă salvată.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează fișa"}</Button>
            {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
          </div>
        )}
      </form>
      {isAdmin && (
        <div className="border-t border-zinc-100 pt-3">
          <AddSheetFieldInline templateId={template.id} />
        </div>
      )}
    </div>
  );
}

function sheetSummary(sheet: ConsultationSheet, fields: ConsultationSheetField[]): string {
  const short = fields
    .filter((f) => f.field_type === "text" && sheet.values[f.id])
    .map((f) => `${f.label} ${sheet.values[f.id]}`);
  if (short.length) return short.join(" · ");
  return fields.map((f) => sheet.values[f.id]).find(Boolean) ?? "Fișă necompletată";
}

function DeleteSheetButton({ sheetId, clientId }: { sheetId: string; clientId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Ștergi definitiv această fișă?")) return;
        startTransition(async () => {
          const result = await deleteConsultationSheet(sheetId, clientId);
          if (result.ok) toast.success("Fișă ștearsă.");
          else toast.error(result.message);
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-60"
    >
      Șterge
    </button>
  );
}

/** Fișele unui pacient de un anumit tip (fișa de consultație sau o fișă
 * construită de admin): listă, creare, editare (admin), PDF. */
export function SheetsPanel({
  clientId,
  template,
  sheets,
  fields,
  patient,
  isAdmin,
}: {
  clientId: string;
  template: SheetTemplate;
  sheets: ConsultationSheet[];
  /** Câmpurile acestui tip, inclusiv cele șterse (pentru fișele vechi). */
  fields: ConsultationSheetField[];
  patient: PatientHeader;
  isAdmin: boolean;
}) {
  // undefined = închis, null = fișă nouă, string = id-ul fișei deschise.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const editedSheet = typeof editing === "string" ? sheets.find((s) => s.id === editing) ?? null : null;
  const latest = sheets[0];
  const defaults: Record<string, string> = {};
  if (latest) {
    for (const f of fields) {
      if (f.carry_over && !f.archived && latest.values[f.id]) defaults[f.id] = latest.values[f.id];
    }
  }
  const lowerName = template.name.charAt(0).toLowerCase() + template.name.slice(1);

  return (
    <section className="mm-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{template.name}</h3>
          {template.description && <p className="text-xs text-zinc-500">{template.description}</p>}
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
          <Plus size={14} className="mr-1 inline" />Fișă nouă
        </Button>
      </div>

      {sheets.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">Nicio {lowerName} încă.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sheets.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white p-2 pl-3">
              <button
                type="button"
                onClick={() => setEditing(s.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {new Date(s.sheet_date).toLocaleDateString("ro-RO")}
                    {s.sheet_number ? ` · Nr. ${s.sheet_number}` : ""}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{sheetSummary(s, fields)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-zinc-300" />
              </button>
              <a
                href={`/admin/fise/${s.id}/pdf`}
                className="mm-btn shrink-0"
                data-variant="ghost"
                title="Descarcă PDF"
              >
                <Download size={14} className="mr-1" />PDF
              </a>
              {isAdmin && <DeleteSheetButton sheetId={s.id} clientId={clientId} />}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => { if (!open) setEditing(undefined); }}
        title={editedSheet ? (isAdmin ? `Editează ${lowerName}` : template.name) : `${template.name} — fișă nouă`}
        description={editedSheet ? `Din ${new Date(editedSheet.sheet_date).toLocaleDateString("ro-RO")}` : template.description ?? undefined}
        size="lg"
      >
        {editing !== undefined && (
          <SheetForm
            key={editing ?? "new"}
            clientId={clientId}
            template={template}
            sheet={editedSheet}
            fields={fields}
            defaults={defaults}
            patient={patient}
            isAdmin={isAdmin}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Dialog>
    </section>
  );
}
