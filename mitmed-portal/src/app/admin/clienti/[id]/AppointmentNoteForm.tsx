"use client";

import { useActionState, useState } from "react";
import { createMedicalRecord } from "@/actions/medicalRecords";

export function AppointmentNoteForm({
  clientId,
  appointmentId,
  therapyId,
  therapyName,
}: {
  clientId: string;
  appointmentId: string;
  therapyId: string;
  therapyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-sm text-sky-600 hover:underline"
      >
        Scrie notițe pentru ședință
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 border-t border-zinc-100 pt-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="therapyId" value={therapyId} />

      <p className="text-xs text-zinc-500">
        Notițe pentru ședința de {therapyName} — la salvare, ședința se marchează ca finalizată.
      </p>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Diagnostic (opțional)</label>
        <input name="diagnosis" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Notițe</label>
        <textarea
          name="notes"
          required
          rows={2}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      {state?.message && <p className="text-xs text-red-600">{state.message}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Salvează și finalizează ședința"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
        >
          Renunță
        </button>
      </div>
    </form>
  );
}
