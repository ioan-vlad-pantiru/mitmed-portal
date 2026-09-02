"use client";

import { useActionState } from "react";
import { createAppointmentForClient } from "@/actions/appointments";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string; sessionsIncluded?: number };

export function AppointmentForm({ clientId, therapies }: { clientId: string; therapies: Therapy[] }) {
  const action = createAppointmentForClient.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3 mm-card p-4">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Terapie</label>
        <Select name="therapyId" className="mt-1">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.sessionsIncluded && t.sessionsIncluded > 1 ? ` (pachet ${t.sessionsIncluded}×)` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Data și ora</label>
        <Input type="datetime-local" name="startsAt" required className="mt-1" />
      </div>

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}

      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se programează…" : "Programează"}
        </Button>
      </div>
    </form>
  );
}
