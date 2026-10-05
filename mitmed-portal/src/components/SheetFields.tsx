"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { createSheetField, deleteSheetField, type ConsultationSheetField } from "@/actions/consultationSheets";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/icons";
import { useToast } from "@/components/Toast";

// Câmpurile configurabile ale fișelor medicale (consultație, tratament, fișe
// construite de admin) — aceeași randare în toate formularele.

type FieldBlock =
  | { kind: "section"; key: string; title: string; fields: ConsultationSheetField[] }
  | { kind: "short"; key: string; fields: ConsultationSheetField[] }
  | { kind: "long"; key: string; field: ConsultationSheetField };

/** Câmpurile consecutive din aceeași secțiune merg într-un chenar; câmpurile
 * scurte consecutive din afara secțiunilor se așază pe același rând. */
function toBlocks(fields: ConsultationSheetField[]): FieldBlock[] {
  const blocks: FieldBlock[] = [];
  for (const f of fields) {
    const last = blocks[blocks.length - 1];
    if (f.section) {
      if (last?.kind === "section" && last.title === f.section) last.fields.push(f);
      else blocks.push({ kind: "section", key: f.id, title: f.section, fields: [f] });
    } else if (f.field_type === "text") {
      if (last?.kind === "short") last.fields.push(f);
      else blocks.push({ kind: "short", key: f.id, fields: [f] });
    } else {
      blocks.push({ kind: "long", key: f.id, field: f });
    }
  }
  return blocks;
}

function RemoveFieldButton({ field }: { field: ConsultationSheetField }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      title="Șterge căsuța din fișă"
      aria-label={`Șterge căsuța „${field.label}”`}
      onClick={() => {
        if (!window.confirm(`Ștergi căsuța „${field.label}”? Nu va mai apărea pe fișele noi; valorile deja completate pe fișele vechi se păstrează.`)) return;
        startTransition(async () => {
          const result = await deleteSheetField(field.id);
          if (result.ok) toast.success("Căsuță ștearsă.");
          else toast.error(result.message);
        });
      }}
      className="ml-1 inline-grid h-5 w-5 place-items-center rounded text-zinc-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <IconClose className="h-3 w-3" />
    </button>
  );
}

function FieldInput({
  field,
  value,
  editable,
  readOnly,
}: {
  field: ConsultationSheetField;
  value: string;
  editable: boolean;
  readOnly: boolean;
}) {
  const id = `field-${field.id}`;
  const common = {
    id,
    name: `field:${field.id}`,
    defaultValue: value,
    placeholder: field.placeholder ?? undefined,
    readOnly,
    className: "mt-1",
  };
  return (
    <div>
      <div className="flex items-center">
        <label htmlFor={id} className="block text-xs font-medium text-zinc-700">
          {field.archived ? `${field.label} (câmp șters)` : field.label}
        </label>
        {editable && !field.archived && <RemoveFieldButton field={field} />}
      </div>
      {field.field_type === "text" ? <Input {...common} /> : <Textarea {...common} rows={field.section ? 2 : 3} />}
    </div>
  );
}

/** Câmpurile unei fișe, ca input-uri `field:<id>` într-un formular.
 * `editable` = adminul poate șterge căsuțe direct de aici. */
export function SheetFieldInputs({
  fields,
  values,
  editable = false,
  readOnly = false,
}: {
  fields: ConsultationSheetField[];
  values: Record<string, string>;
  editable?: boolean;
  readOnly?: boolean;
}) {
  const grid = (items: ConsultationSheetField[], wide?: boolean) => (
    <div className={`grid gap-3 ${wide ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3"}`}>
      {items.map((f) => (
        <FieldInput key={f.id} field={f} value={values[f.id] ?? ""} editable={editable} readOnly={readOnly} />
      ))}
    </div>
  );
  return (
    <>
      {toBlocks(fields).map((block) => {
        if (block.kind === "section") {
          return (
            <fieldset key={block.key} className="rounded-lg border border-zinc-100 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{block.title}</legend>
              {grid(block.fields, true)}
            </fieldset>
          );
        }
        if (block.kind === "short") return <div key={block.key}>{grid(block.fields)}</div>;
        return (
          <FieldInput key={block.key} field={block.field} value={values[block.field.id] ?? ""} editable={editable} readOnly={readOnly} />
        );
      })}
    </>
  );
}

/** Valorile completate (read-only), ex. în detaliul unei ședințe. */
export function SheetFieldValues({ fields, values }: { fields: ConsultationSheetField[]; values: Record<string, string> }) {
  const shown = fields.filter((f) => values[f.id]);
  if (shown.length === 0) return null;
  return (
    <dl className="space-y-2">
      {shown.map((f) => (
        <div key={f.id} className="rounded-lg border border-zinc-100 bg-white p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{f.label}</dt>
          <dd className="mt-1 whitespace-pre-line text-sm text-zinc-700">{values[f.id]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Butonul „Adaugă căsuță” de pe fișă (doar admin): o căsuță nouă, denumită pe
 * loc, care apare pe toate fișele de acest tip. Trebuie randat ÎN AFARA
 * formularului fișei (formularele nu se pot imbrica). */
export function AddSheetFieldInline({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1 inline" />Adaugă căsuță
        </Button>
        <Link href={`/admin/fisa-consultatie?t=${templateId}`} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
          <Settings2 size={13} /> Redenumește / reordonează căsuțele
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await createSheetField(templateId, undefined, formData);
          if (result?.success) {
            toast.success("Căsuță adăugată pe fișă.");
            formRef.current?.reset();
            setOpen(false);
          } else {
            toast.error(result?.message ?? "Nu am putut adăuga căsuța.");
          }
        });
      }}
      className="rounded-lg border border-dashed border-zinc-300 p-3"
    >
      <p className="text-xs font-medium text-zinc-700">Căsuță nouă pe acest tip de fișă</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <Input name="label" required maxLength={120} placeholder="Denumire, ex: Mobilitate umăr" aria-label="Denumirea căsuței" autoFocus />
        <Select name="fieldType" defaultValue="textarea" aria-label="Mărimea căsuței">
          <option value="textarea">Text lung</option>
          <option value="text">Text scurt (o valoare)</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Se adaugă…" : "Adaugă"}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Renunță</Button>
        </div>
      </div>
    </form>
  );
}
