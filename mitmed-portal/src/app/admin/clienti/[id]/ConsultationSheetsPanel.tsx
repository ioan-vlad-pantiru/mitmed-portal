"use client";

import { useActionState, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { createConsultationSheet, updateConsultationSheet } from "@/actions/consultationSheets";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type ConsultationSheet = {
  id: string;
  sheet_date: string;
  sheet_number: string | null;
  marital_status: string | null;
  antecedents: string | null;
  working_conditions: string | null;
  blood_pressure: string | null;
  pulse: string | null;
  oxygen_saturation: string | null;
  glycemia: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  recommendations: string | null;
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

function SheetForm({
  clientId,
  sheet,
  defaults,
  patient,
  onSaved,
}: {
  clientId: string;
  sheet: ConsultationSheet | null;
  defaults: Partial<ConsultationSheet>;
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
  const v = sheet ?? defaults;
  const today = new Date().toISOString().slice(0, 10);

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
          <Input id="sheetNumber" name="sheetNumber" defaultValue={v.sheet_number ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="maritalStatus">Starea civilă</Label>
          <Input id="maritalStatus" name="maritalStatus" defaultValue={v.marital_status ?? ""} className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="antecedents">Antecedente</Label>
        <Textarea id="antecedents" name="antecedents" rows={2} defaultValue={v.antecedents ?? ""} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="workingConditions">Condiții de muncă</Label>
        <Textarea id="workingConditions" name="workingConditions" rows={2} defaultValue={v.working_conditions ?? ""} className="mt-1" />
      </div>

      <fieldset className="rounded-lg border border-zinc-100 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Consultații / Investigații / Evaluări</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="bloodPressure">Tensiune arterială</Label>
            <Input id="bloodPressure" name="bloodPressure" defaultValue={sheet?.blood_pressure ?? ""} placeholder="ex: 120/80" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="pulse">Puls</Label>
            <Input id="pulse" name="pulse" defaultValue={sheet?.pulse ?? ""} placeholder="bătăi/min" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="oxygenSaturation">Saturație O2</Label>
            <Input id="oxygenSaturation" name="oxygenSaturation" defaultValue={sheet?.oxygen_saturation ?? ""} placeholder="%" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="glycemia">Glicemie</Label>
            <Input id="glycemia" name="glycemia" defaultValue={sheet?.glycemia ?? ""} placeholder="mg/dl" className="mt-1" />
          </div>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="symptoms">Semne și simptome</Label>
        <Textarea id="symptoms" name="symptoms" rows={3} defaultValue={sheet?.symptoms ?? ""} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="diagnosis">Diagnostic</Label>
        <Textarea id="diagnosis" name="diagnosis" rows={2} defaultValue={sheet?.diagnosis ?? ""} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="recommendations">Recomandări</Label>
        <Textarea id="recommendations" name="recommendations" rows={3} defaultValue={sheet?.recommendations ?? ""} className="mt-1" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează fișa"}</Button>
        {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}

const SUMMARY_FIELDS: [keyof ConsultationSheet, string][] = [
  ["antecedents", "Antecedente"],
  ["working_conditions", "Condiții de muncă"],
  ["symptoms", "Semne și simptome"],
  ["diagnosis", "Diagnostic"],
  ["recommendations", "Recomandări"],
];

/** Fișele de consultații și evaluări medicale ale pacientului (prima vizită și
 * reconsult), cu formularul cabinetului pentru creare și editare. */
export function ConsultationSheetsPanel({
  clientId,
  sheets,
  patient,
}: {
  clientId: string;
  sheets: ConsultationSheet[];
  patient: PatientHeader;
}) {
  // undefined = închis, null = fișă nouă, string = id-ul fișei editate.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const editedSheet = typeof editing === "string" ? sheets.find((s) => s.id === editing) ?? null : null;
  const latest = sheets[0];
  const defaults: Partial<ConsultationSheet> = latest
    ? { marital_status: latest.marital_status, antecedents: latest.antecedents, working_conditions: latest.working_conditions }
    : {};

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
                  {s.diagnosis ? ` · ${s.diagnosis}` : ""}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {[
                    s.blood_pressure && `TA ${s.blood_pressure}`,
                    s.pulse && `Puls ${s.pulse}`,
                    s.oxygen_saturation && `SpO2 ${s.oxygen_saturation}`,
                    s.glycemia && `Glicemie ${s.glycemia}`,
                  ].filter(Boolean).join(" · ") || SUMMARY_FIELDS.map(([k]) => s[k]).find(Boolean)?.toString() || "Fișă necompletată"}
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
            defaults={defaults}
            patient={patient}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Dialog>
    </section>
  );
}
