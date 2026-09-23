"use client";

import { useActionState } from "react";
import { updateClientUnlockedTherapies } from "@/actions/clients";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string; is_consultation: boolean };

/** Terapiile "de consultație" sunt mereu rezervabile din portal — nu au ce
 * căuta în lista de bifat, doar restul catalogului. */
export function UnlockedTherapiesForm({
  clientId,
  therapies,
  unlockedTherapyIds,
}: {
  clientId: string;
  therapies: Therapy[];
  unlockedTherapyIds: string[];
}) {
  const [state, action, pending] = useActionState(updateClientUnlockedTherapies.bind(null, clientId), undefined);
  const bookable = therapies.filter((t) => !t.is_consultation);
  const unlocked = new Set(unlockedTherapyIds);

  return (
    <form action={action} className="mt-3 mm-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Terapii deblocate pentru acest client
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Un client nou poate rezerva singur din portal doar o consultație. Bifează aici ce altceva poate rezerva
        singur, de obicei după ce l-ai văzut la consultație.
      </p>
      {bookable.length ? (
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {bookable.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="therapyIds" value={t.id} defaultChecked={unlocked.has(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">Nu există alte terapii în catalog momentan.</p>
      )}
      {state?.message && (
        <p className={`mt-2 text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      )}
      <div className="mt-3">
        <Button type="submit" variant="secondary" disabled={pending || !bookable.length}>
          {pending ? "Se salvează…" : "Salvează"}
        </Button>
      </div>
    </form>
  );
}
