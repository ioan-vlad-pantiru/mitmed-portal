"use client";

import { useActionState } from "react";
import { createTherapy } from "@/actions/therapies";
import { TherapyFields } from "./TherapyFields";

export function TherapyForm() {
  const [state, action, pending] = useActionState(createTherapy, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-2xl grid-cols-2 gap-3 mm-card p-4">
      <TherapyFields />
      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Adaugă terapie"}
        </button>
      </div>
    </form>
  );
}
