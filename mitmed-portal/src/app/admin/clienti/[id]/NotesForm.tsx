"use client";

import { useActionState } from "react";
import { updateClientNotes } from "@/actions/clients";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Note interne despre client — nu sunt parte din fișa medicală, nu sunt
 * niciodată vizibile clientului (spre deosebire de chestionarul medical sau
 * planul de tratament). Utile pentru context operațional: preferințe,
 * particularități, ce trebuie reținut la recepție. */
export function NotesForm({ clientId, notes }: { clientId: string; notes: string | null }) {
  const [state, action, pending] = useActionState(updateClientNotes.bind(null, clientId), undefined);

  return (
    <form action={action} className="mm-card p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Note interne</h2>
      <p className="mt-1 text-xs text-zinc-500">Vizibile doar personalului — clientul nu le vede niciodată.</p>
      <Textarea
        name="notes"
        rows={3}
        defaultValue={notes ?? ""}
        placeholder="ex: preferă programări dimineața, alergic la ulei de migdale…"
        className="mt-2"
      />
      {state?.message && (
        <p className={`mt-2 text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      )}
      <div className="mt-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salvează…" : "Salvează notele"}
        </Button>
      </div>
    </form>
  );
}
