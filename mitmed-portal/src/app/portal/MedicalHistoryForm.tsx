"use client";

import { useActionState } from "react";
import { updateOwnMedicalHistory } from "@/actions/clients";

type MedicalHistory = {
  allergies?: string;
  conditions?: string;
  medications?: string;
  previous_injuries?: string;
  notes?: string;
} | null;

export function MedicalHistoryForm({ initial }: { initial: MedicalHistory }) {
  const [state, action, pending] = useActionState(updateOwnMedicalHistory, undefined);

  return (
    <form action={action} className="mt-3 space-y-3 mm-card p-4">
      <p className="text-xs text-zinc-500">
        Ajută-ne să te tratăm mai bine — completează înainte de prima ședință. Admin/recepția
        vede aceste informații.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Alergii</label>
          <input
            name="allergies"
            defaultValue={initial?.allergies}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Afecțiuni cunoscute</label>
          <input
            name="conditions"
            defaultValue={initial?.conditions}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Medicamente curente</label>
          <input
            name="medications"
            defaultValue={initial?.medications}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Leziuni/operații anterioare</label>
          <input
            name="previousInjuries"
            defaultValue={initial?.previous_injuries}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Alte note (opțional)</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      {state?.message && (
        <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "Se salvează…" : "Salvează chestionarul"}
      </button>
    </form>
  );
}
