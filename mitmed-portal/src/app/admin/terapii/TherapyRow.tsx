"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTherapy, toggleTherapyActive, updateTherapy } from "@/actions/therapies";
import { TherapyFields } from "./TherapyFields";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconEdit, IconPower, IconTrash, IconClose } from "@/components/icons";

type Therapy = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  active: boolean;
  isConsultation: boolean;
};

export function TherapyRow({ therapy }: { therapy: Therapy }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = updateTherapy.bind(null, therapy.id);
  const [state, action, saving] = useActionState(updateAction, undefined);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <tr className="transition-colors hover:bg-zinc-50/70">
        <td className="px-4 py-2 text-zinc-900">
          <span className="flex items-center gap-1.5">
            {therapy.name}
            {therapy.isConsultation && <Badge variant="neutral">Consultație</Badge>}
          </span>
          {therapy.description && <p className="text-xs text-zinc-400">{therapy.description}</p>}
        </td>
        <td className="px-4 py-2 text-zinc-600">{therapy.durationMinutes} min</td>
        <td className="px-4 py-2 text-zinc-600">{therapy.price} RON</td>
        <td className="px-4 py-2">
          <Badge variant={therapy.active ? "success" : "neutral"}>{therapy.active ? "Da" : "Nu"}</Badge>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-1">
            <IconButton
              icon={editing ? IconClose : IconEdit}
              label={editing ? "Renunță" : "Editează"}
              onClick={() => setEditing((v) => !v)}
            />
            <IconButton
              icon={IconPower}
              label={therapy.active ? "Dezactivează" : "Activează"}
              variant={therapy.active ? "warning" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await toggleTherapyActive(therapy.id, !therapy.active);
                    toast.success(therapy.active ? "Terapie dezactivată." : "Terapie activată.");
                    router.refresh();
                  } catch {
                    toast.error("Nu am putut schimba statusul. Încearcă din nou.");
                  }
                })
              }
            />
            <IconButton
              icon={IconTrash}
              label="Șterge"
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Ștergi terapia „${therapy.name}"? Dispare din catalog și nu mai poate fi rezervată. Programările, plățile și fișele vechi o păstrează în istoric.`
                  )
                )
                  return;
                startTransition(async () => {
                  const result = await deleteTherapy(therapy.id);
                  if (result.ok) {
                    toast.success(result.archived ? "Terapie ștearsă din catalog (istoricul rămâne)." : "Terapie ștearsă.");
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                });
              }}
            />
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-zinc-50/60 px-4 py-4">
            <form action={action} className="grid max-w-2xl grid-cols-2 gap-3">
              <TherapyFields defaults={{ ...therapy, isConsultation: therapy.isConsultation }} />
              {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează modificările"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Anulează
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
