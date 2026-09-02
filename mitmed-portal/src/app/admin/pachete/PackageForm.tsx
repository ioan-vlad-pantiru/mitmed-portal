"use client";

import { useActionState } from "react";
import { createPackage } from "@/actions/packages";
import { PackageFields } from "./PackageFields";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string };

export function PackageForm({ therapies }: { therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createPackage, undefined);

  if (therapies.length === 0) {
    return <p className="mt-3 text-sm text-zinc-400">Definește cel puțin o terapie înainte de a crea un pachet.</p>;
  }

  return (
    <form action={action} className="mt-3 grid max-w-2xl grid-cols-2 gap-3 mm-card p-4">
      <PackageFields therapies={therapies} />
      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Adaugă pachet"}
        </Button>
      </div>
    </form>
  );
}
