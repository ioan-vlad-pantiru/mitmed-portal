"use client";

import { useActionState, useState } from "react";
import { createMedicalRecord } from "@/actions/medicalRecords";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";

type Therapy = { id: string; name: string };

export function MedicalRecordForm({ clientId, therapies }: { clientId: string; therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>([]);

  return (
    <form action={action} className="mt-3 space-y-3 mm-card p-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Terapie (opțional)</label>
          <select name="therapyId" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">—</option>
            {therapies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Diagnostic</label>
          <input name="diagnosis" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Notițe ședință</label>
        <textarea
          name="notes"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Zonă tratată/dureroasă (opțional)</label>
        <div className="mt-1 rounded-md border border-zinc-200 p-3">
          <BodyMapPicker value={bodyMap} onChange={setBodyMap} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "Se salvează…" : "Adaugă intrare"}
      </button>
    </form>
  );
}
