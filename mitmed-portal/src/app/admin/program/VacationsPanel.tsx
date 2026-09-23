"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVacation, deleteVacation, type Vacation } from "@/actions/clinic";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { IconTrash } from "@/components/icons";

function formatRange(startsOn: string, endsOn: string): string {
  const start = new Date(`${startsOn}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  if (startsOn === endsOn) return start;
  const end = new Date(`${endsOn}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  return `${start} – ${end}`;
}

export function VacationsPanel({ vacations }: { vacations: Vacation[] }) {
  const [state, action, pending] = useActionState(createVacation, undefined);
  const [deleting, startDeleteTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = vacations
    .filter((v) => v.ends_on >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const past = vacations.filter((v) => v.ends_on < today).sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  function remove(id: string) {
    startDeleteTransition(async () => {
      try {
        await deleteVacation(id);
        toast.success("Vacanță ștearsă.");
        router.refresh();
      } catch {
        toast.error("Nu am putut șterge vacanța. Încearcă din nou.");
      }
    });
  }

  return (
    <div className="mm-card p-4">
      <h2 className="text-sm font-medium text-zinc-700">Vacanțe și zile închise</h2>
      <p className="mt-1 text-xs text-zinc-500">
        În aceste perioade, cabinetul e complet închis — nimeni nu poate face programări noi (nici din portal, nici
        din recepție). Programările deja existente nu sunt atinse automat.
      </p>

      {upcoming.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-100">
          {upcoming.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium text-zinc-800">{formatRange(v.starts_on, v.ends_on)}</p>
                {v.label && <p className="text-xs text-zinc-500">{v.label}</p>}
              </div>
              <IconButton icon={IconTrash} label="Șterge vacanța" variant="danger" disabled={deleting} onClick={() => remove(v.id)} />
            </li>
          ))}
        </ul>
      )}
      {upcoming.length === 0 && <p className="mt-3 text-sm text-zinc-400">Nicio vacanță programată.</p>}

      <form action={action} className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Din</label>
          <Input type="date" name="startsOn" required min={today} className="mt-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Până (inclusiv)</label>
          <Input type="date" name="endsOn" required min={today} className="mt-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Motiv (opțional)</label>
          <Input name="label" placeholder="ex: Concediu de odihnă" className="mt-1" />
        </div>
        {state?.message && <p className="col-span-full text-sm text-red-600">{state.message}</p>}
        <div className="col-span-full">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Se adaugă…" : "Adaugă vacanță"}
          </Button>
        </div>
      </form>

      {past.length > 0 && (
        <details className="mt-4 border-t border-zinc-100 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">Vacanțe trecute ({past.length})</summary>
          <ul className="mt-2 divide-y divide-zinc-100">
            {past.map((v) => (
              <li key={v.id} className="py-1.5 text-sm text-zinc-500">
                {formatRange(v.starts_on, v.ends_on)}
                {v.label && <span className="text-zinc-400"> · {v.label}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
