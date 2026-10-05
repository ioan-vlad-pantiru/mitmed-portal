"use client";

import { useActionState, useEffect, useState } from "react";
import { Activity, ChevronRight, ClipboardCheck, Download, Home, MapPin, MessageSquareText, Ruler } from "lucide-react";
import { updateMedicalRecord } from "@/actions/medicalRecords";
import type { ConsultationSheetField } from "@/actions/consultationSheets";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BodyMapView } from "@/components/BodyMap";
import { TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import { AddSheetFieldInline, SheetFieldInputs, SheetFieldValues } from "@/components/SheetFields";
import { useToast } from "@/components/Toast";
import { TherapyCheckboxes } from "@/components/TherapyCheckboxes";

type MedicalRecord = {
  id: string;
  session_date: string;
  diagnosis: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  notes: string;
  treatment_plan: string | null;
  body_map: { x: number; y: number; label?: string }[] | null;
  field_values: Record<string, string>;
  therapy: { name: string } | null;
  therapies: { id: string; name: string }[];
  author: { email: string } | null;
};

// Fișa de tratament = ședințele pacientului. O ședință completă e mult
// conținut (S/O/A + intervenții + plan + hartă corporală + căsuțele adăugate
// de admin) — overview-ul arată doar esențialul (dată, diagnostic/terapie,
// autor); click deschide totul în modal, unde adminul îl poate și corecta.
export function MedicalRecordsPanel({
  clientId,
  records,
  extraFields,
  therapies,
  isAdmin,
}: {
  clientId: string;
  records: MedicalRecord[];
  /** Terapiile active, pentru corectarea terapiilor unei ședințe. */
  therapies: { id: string; name: string }[];
  /** Căsuțele fișei de tratament, inclusiv cele șterse (pentru ședințele vechi). */
  extraFields: ConsultationSheetField[];
  isAdmin: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = records.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {records.length === 0 ? "Nicio ședință încă." : `${records.length} ${records.length === 1 ? "ședință" : "ședințe"}`}
        </p>
        {records.length > 0 && (
          <a href={`/admin/clienti/${clientId}/fisa-tratament`} className="mm-btn" data-variant="ghost">
            <Download size={14} className="mr-1" />Descarcă fișa de tratament (PDF)
          </a>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {records.map((r) => {
          const date = new Date(r.session_date);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              className="mm-card flex w-full items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 hover:border-[var(--mitmed-sky)]/40"
            >
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--mm-info-bg)] text-[var(--mitmed-teal-deep)]">
                <span className="mm-numeric text-[10px] font-semibold uppercase leading-none">
                  {date.toLocaleDateString("ro-RO", { month: "short" }).replace(".", "")}
                </span>
                <span className="mm-numeric text-base font-bold leading-none">{date.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {r.diagnosis || r.therapy?.name || "Ședință"}
                  </p>
                  {r.body_map && r.body_map.length > 0 && (
                    <MapPin size={13} className="shrink-0 text-zinc-400" aria-label="Hartă corporală atașată" />
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {r.therapy?.name ?? "—"} · {r.author?.email ?? "—"}
                </p>
              </div>
              <span className="mm-numeric shrink-0 text-xs text-zinc-400">
                {date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <ChevronRight size={16} className="shrink-0 text-zinc-300" />
            </button>
          );
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => { if (!open) { setOpenId(null); setEditing(false); } }}
        title={selected?.diagnosis || selected?.therapy?.name || "Ședință"}
        description={
          selected
            ? `${new Date(selected.session_date).toLocaleString("ro-RO")} · ${selected.therapy?.name ?? "—"} · scris de ${selected.author?.email ?? "—"}`
            : undefined
        }
        size="lg"
      >
        {selected && editing && (
          <EditRecordForm
            key={selected.id}
            record={selected}
            clientId={clientId}
            extraFields={extraFields}
            therapies={therapies}
            onDone={() => setEditing(false)}
          />
        )}
        {selected && !editing && (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {isAdmin && (
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={() => setEditing(true)}>Editează ședința</Button>
              </div>
            )}
            <SoapField icon={MessageSquareText} label="S · Relatarea clientului" value={selected.subjective} accent="sky" />
            <SoapField icon={Ruler} label="O · Observații și măsurători" value={selected.objective} accent="teal" />
            <SoapField icon={Activity} label="A · Evaluare clinică" value={selected.assessment} accent="teal" />
            <SoapField icon={ClipboardCheck} label="Intervenții efectuate și răspuns" value={selected.notes} accent="teal" />
            <SheetFieldValues fields={extraFields} values={selected.field_values ?? {}} />
            <SoapField icon={Home} label="P · Plan următoare" value={selected.treatment_plan} accent="highlight" />
            {selected.body_map && selected.body_map.length > 0 && (
              <div className="rounded-lg border border-zinc-100 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hartă corporală</p>
                <div className="mt-2 rounded-lg bg-zinc-50 p-2">
                  <BodyMapView points={selected.body_map} />
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

function EditRecordForm({
  record,
  clientId,
  extraFields,
  therapies,
  onDone,
}: {
  record: MedicalRecord;
  clientId: string;
  extraFields: ConsultationSheetField[];
  therapies: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateMedicalRecord.bind(null, record.id, clientId), undefined);
  const toast = useToast();
  const values = record.field_values ?? {};
  const shownExtra = extraFields.filter((f) => !f.archived || values[f.id]);

  useEffect(() => {
    if (!state?.success) return;
    toast.success("Ședința a fost actualizată.");
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const area = (name: string, label: string, value: string | null, rows = 2, required = false) => (
    <div>
      <label htmlFor={`edit-${name}`} className="block text-xs font-medium text-zinc-700">{label}</label>
      <Textarea id={`edit-${name}`} name={name} rows={rows} required={required} defaultValue={value ?? ""} className="mt-1" />
    </div>
  );

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <form action={action} className="space-y-3">
        <TherapyCheckboxes
          // Terapiile dezactivate între timp rămân bifabile pe ședința care le are.
          therapies={[...therapies, ...(record.therapies ?? []).filter((t) => !therapies.some((x) => x.id === t.id))]}
          selected={(record.therapies ?? []).map((t) => t.id)}
        />
        <div>
          <label htmlFor="edit-diagnosis" className="block text-xs font-medium text-zinc-700">Diagnostic</label>
          <Input id="edit-diagnosis" name="diagnosis" defaultValue={record.diagnosis ?? ""} className="mt-1" />
        </div>
        {area("notes", "Proceduri / intervenții efectuate și răspuns", record.notes, 3, true)}
        {area("subjective", "S · Relatarea clientului", record.subjective)}
        {area("objective", "O · Observații și măsurători", record.objective)}
        {area("assessment", "A · Evaluare clinică", record.assessment)}
        <SheetFieldInputs fields={shownExtra} values={values} editable />
        {area("treatmentPlan", "P · Plan următoare", record.treatment_plan)}
        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează ședința"}</Button>
          <Button type="button" variant="ghost" onClick={onDone}>Renunță</Button>
        </div>
      </form>
      <div className="border-t border-zinc-100 pt-3">
        <AddSheetFieldInline templateId={TEMPLATE_TRATAMENT} />
      </div>
    </div>
  );
}

const ACCENT_STYLES = {
  sky: { card: "border-sky-100 bg-sky-50/40", badge: "bg-sky-100 text-sky-700", label: "text-sky-800" },
  teal: { card: "border-zinc-100 bg-white", badge: "bg-[var(--mm-info-bg)] text-[var(--mitmed-teal)]", label: "text-zinc-500" },
  highlight: {
    card: "border-[var(--mitmed-teal)]/25 bg-[var(--mm-info-bg)]",
    badge: "bg-white text-[var(--mitmed-teal)]",
    label: "text-[var(--mitmed-teal-deep)]",
  },
} as const;

// Chip-urile din consult scriu linii "• Text" — le despărțim în puncte
// distincte în loc să le afișăm ca un singur bloc de text cu caractere "•"
// amestecate cu text liber.
function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim().replace(/^•\s*/, ""))
    .filter(Boolean);
}

// Randează o secțiune SOAP doar dacă a fost completată — înregistrările mai
// vechi (dinainte de câmpurile S/O/A) nu au aceste valori.
function SoapField({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | null;
  accent: keyof typeof ACCENT_STYLES;
}) {
  if (!value) return null;
  const style = ACCENT_STYLES[accent];
  const lines = parseLines(value);
  return (
    <div className={`rounded-lg border p-3 ${style.card}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${style.badge}`}>
          <Icon size={14} />
        </span>
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${style.label}`}>{label}</h3>
      </div>
      <ul className="mt-2 space-y-1 pl-9 text-sm text-zinc-700">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
