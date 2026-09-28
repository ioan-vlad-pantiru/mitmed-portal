import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listConsultationSheetFields } from "@/actions/consultationSheets";
import { SheetFieldForm } from "./SheetFieldForm";
import { SheetFieldRow } from "./SheetFieldRow";

export default async function ConsultationSheetSettingsPage() {
  await requireRole(Role.ADMIN);
  const fields = await listConsultationSheetFields();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Fișa de consultație</h1>
        <p className="text-sm text-zinc-500">
          Câmpurile care apar pe fișa de consultații și evaluări medicale, în ordinea din formular. Data și numărul
          fișei sunt mereu prezente. Un câmp șters nu mai apare pe fișele noi, dar valorile deja completate pe fișele
          vechi se păstrează.
        </p>
      </div>

      <div className="space-y-2">
        {fields.map((f, i) => (
          <SheetFieldRow key={f.id} field={f} isFirst={i === 0} isLast={i === fields.length - 1} />
        ))}
        {fields.length === 0 && <p className="mm-card p-6 text-center text-sm text-zinc-400">Niciun câmp încă.</p>}
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă câmp nou</h2>
        <SheetFieldForm />
      </div>
    </div>
  );
}
