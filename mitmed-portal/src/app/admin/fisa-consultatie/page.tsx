import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listConsultationSheetFields, listSheetTemplates } from "@/actions/consultationSheets";
import { TEMPLATE_CONSULTATIE } from "@/lib/sheetTemplates";
import { SheetFieldForm } from "./SheetFieldForm";
import { SheetFieldRow } from "./SheetFieldRow";
import { TemplateForm } from "./TemplateForm";

const KIND_HINT: Record<string, string> = {
  consultatie:
    "Câmpurile fișei de consultații și evaluări medicale, în ordinea din formular. Data și numărul fișei sunt mereu prezente.",
  tratament:
    "Căsuțe suplimentare pe fișa de tratament (completată la fiecare ședință), pe lângă câmpurile fixe: proceduri efectuate, relatarea pacientului, observații, evaluare și plan.",
  custom: "Câmpurile acestei fișe, în ordinea din formular. Data și numărul fișei sunt mereu prezente.",
};

export default async function SheetSettingsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireRole(Role.ADMIN);
  const { t } = await searchParams;
  const templates = await listSheetTemplates();
  const creating = t === "nou";
  const selected = creating ? undefined : templates.find((x) => x.id === t) ?? templates.find((x) => x.id === TEMPLATE_CONSULTATIE);
  const fields = selected ? await listConsultationSheetFields(false, selected.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Fișe medicale</h1>
        <p className="text-sm text-zinc-500">
          Construiește fișele din dosarul pacientului: adaugă, redenumește, reordonează sau șterge căsuțe. Un câmp șters
          nu mai apare pe fișele noi, dar valorile deja completate pe fișele vechi se păstrează.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Tipuri de fișe">
        {templates.map((x) => (
          <Link
            key={x.id}
            href={`/admin/fisa-consultatie?t=${x.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${selected?.id === x.id ? "border-[var(--mitmed-teal)] bg-[var(--mm-info-bg)] font-medium text-[var(--mitmed-teal-deep)]" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
          >
            {x.name}
          </Link>
        ))}
        <Link
          href="/admin/fisa-consultatie?t=nou"
          className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm ${creating ? "border-[var(--mitmed-teal)] text-[var(--mitmed-teal-deep)]" : "border-zinc-300 text-zinc-600 hover:border-zinc-400"}`}
        >
          <Plus size={14} /> Fișă nouă
        </Link>
      </nav>

      {creating && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Fișă nouă</h2>
          <p className="text-sm text-zinc-500">După creare îi adaugi căsuțele. Fișa apare apoi în dosarul medical al fiecărui pacient.</p>
          <TemplateForm />
        </section>
      )}

      {selected && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-700">Despre fișă</h2>
            <TemplateForm key={selected.id} template={selected} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-700">Căsuțe</h2>
            <p className="text-sm text-zinc-500">{KIND_HINT[selected.kind]}</p>
            {fields.map((f, i) => (
              <SheetFieldRow key={f.id} field={f} isFirst={i === 0} isLast={i === fields.length - 1} />
            ))}
            {fields.length === 0 && <p className="mm-card p-6 text-center text-sm text-zinc-400">Niciun câmp încă.</p>}
          </section>

          <div>
            <h2 className="text-sm font-medium text-zinc-700">Adaugă câmp nou</h2>
            <SheetFieldForm key={selected.id} templateId={selected.id} />
          </div>
        </>
      )}
    </div>
  );
}
