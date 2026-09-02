"use client";

import { useActionState } from "react";
import { createTherapy } from "@/actions/therapies";
import { TherapyFields } from "./TherapyFields";
import { Button } from "@/components/ui/Button";

export function TherapyForm() {
  const [state, action, pending] = useActionState(createTherapy, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-2xl grid-cols-2 gap-3 mm-card p-4">
      <TherapyFields />
      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Adaugă terapie"}
        </Button>
      </div>
    </form>
  );
}
