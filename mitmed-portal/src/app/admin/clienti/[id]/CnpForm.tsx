"use client";

import { useActionState } from "react";
import { updateClientCnp } from "@/actions/clients";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CnpForm({ clientId, cnp }: { clientId: string; cnp: string | null }) {
  const [state, action, pending] = useActionState(updateClientCnp.bind(null, clientId), undefined);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3 mm-card p-4">
      <div>
        <label htmlFor="cnp" className="block text-xs font-medium text-zinc-700">CNP</label>
        <Input
          id="cnp"
          name="cnp"
          defaultValue={cnp ?? ""}
          inputMode="numeric"
          pattern="\d{13}"
          maxLength={13}
          autoComplete="off"
          placeholder="13 cifre"
          className="mt-1 w-44 tabular-nums"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Se salvează…" : "Salvează CNP"}
      </Button>
      {state?.message && (
        <p className={`w-full text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
