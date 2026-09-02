"use client";

import { useActionState } from "react";
import { createOwnAppointment } from "@/actions/appointments";

type Therapy = { id: string; name: string; price: string; durationMinutes: number };

export function BookingForm({ therapies }: { therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createOwnAppointment, undefined);

  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-3 mm-card p-4">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Terapie</label>
        <select name="therapyId" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.durationMinutes} min — {t.price} RON
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Data și ora</label>
        <input
          type="datetime-local"
          name="startsAt"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Se programează…" : "Programează-mă"}
        </button>
      </div>
    </form>
  );
}
