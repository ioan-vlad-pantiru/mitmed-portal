"use client";

import { useActionState, useState } from "react";
import { createMedicalRecord } from "@/actions/medicalRecords";
import type { ConsultationSheetField } from "@/actions/consultationSheets";
import { TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import { AddSheetFieldInline, SheetFieldInputs } from "@/components/SheetFields";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";
import { Input, Textarea } from "@/components/ui/Input";
import { TherapyCheckboxes } from "@/components/TherapyCheckboxes";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string };

export function MedicalRecordForm({
  clientId,
  therapies,
  extraFields,
  isAdmin,
}: {
  clientId: string;
  therapies: Therapy[];
  /** Căsuțele fișei de tratament configurate de admin (doar cele active). */
  extraFields: ConsultationSheetField[];
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>([]);

  return (
    <div className="mt-3 space-y-3 mm-card p-4">
    <h4 className="text-sm font-semibold text-zinc-900">Ședință nouă</h4>
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} />

      <TherapyCheckboxes therapies={therapies} />
      <div className="sm:max-w-sm">
        <label className="block text-xs font-medium text-zinc-700">Diagnostic</label>
        <Input name="diagnosis" className="mt-1" />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Proceduri efectuate și desfășurarea ședinței</label>
        <Textarea name="notes" required rows={3} className="mt-1" />
      </div>

      <SheetFieldInputs fields={extraFields} values={{}} editable={isAdmin} />

      <div>
        <label className="block text-xs font-medium text-zinc-700">Plan de tratament (opțional)</label>
        <Textarea name="treatmentPlan" rows={2} className="mt-1" />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Zonă tratată/dureroasă (opțional)</label>
        <div className="mt-1 rounded-md border border-zinc-200 p-3">
          <BodyMapPicker value={bodyMap} onChange={setBodyMap} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează…" : "Adaugă ședința"}
      </Button>
    </form>
    {isAdmin && <AddSheetFieldInline templateId={TEMPLATE_TRATAMENT} />}
    </div>
  );
}
