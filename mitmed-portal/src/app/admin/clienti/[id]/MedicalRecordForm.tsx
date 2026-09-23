"use client";

import { useActionState, useState } from "react";
import { createMedicalRecord } from "@/actions/medicalRecords";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string };

export function MedicalRecordForm({ clientId, therapies }: { clientId: string; therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>([]);

  return (
    <form action={action} className="mt-3 space-y-3 mm-card p-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Terapie (opțional)</label>
          <Select name="therapyId" className="mt-1">
            <option value="">—</option>
            {therapies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Diagnostic</label>
          <Input name="diagnosis" className="mt-1" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Notițe ședință</label>
        <Textarea name="notes" required rows={3} className="mt-1" />
      </div>

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
        {pending ? "Se salvează…" : "Adaugă intrare"}
      </Button>
    </form>
  );
}
