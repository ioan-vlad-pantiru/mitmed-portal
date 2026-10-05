"use client";

import { useActionState } from "react";
import { createFidelityCardType } from "@/actions/fidelity";
import { CardTypeEditor } from "./CardTypeEditor";
import { Button } from "@/components/ui/Button";

export function CardTypeForm({ therapies }: { therapies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createFidelityCardType, undefined);

  if (!therapies.length) {
    return <p className="mt-3 text-sm text-zinc-400">Adaugă mai întâi o terapie în catalog, ca să poți lega un card de ea.</p>;
  }

  return (
    <form action={action} className="mt-3 grid max-w-2xl grid-cols-2 gap-3 mm-card p-4">
      <CardTypeEditor therapies={therapies} />
      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Adaugă tip de card"}
        </Button>
      </div>
    </form>
  );
}
