"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFidelityCardType, toggleFidelityCardTypeActive, updateFidelityCardType, type FidelityCardType } from "@/actions/fidelity";
import { TierEditor } from "./TierEditor";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconEdit, IconPower, IconTrash, IconClose } from "@/components/icons";

function tiersSummary(cardType: FidelityCardType): string {
  return cardType.tiers
    .slice()
    .sort((a, b) => a.session_number - b.session_number)
    .map((t) => `a ${t.session_number}-a -${Number(t.discount_percent)}%`)
    .join(", ");
}

export function CardTypeRow({
  cardType,
  therapies,
}: {
  cardType: FidelityCardType;
  therapies: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = updateFidelityCardType.bind(null, cardType.id);
  const [state, action, saving] = useActionState(updateAction, undefined);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <tr className="transition-colors hover:bg-zinc-50/70">
        <td className="px-4 py-2 text-zinc-900">{cardType.name}</td>
        <td className="px-4 py-2 text-zinc-600">{cardType.therapy_name}</td>
        <td className="px-4 py-2 text-zinc-600">{tiersSummary(cardType)}</td>
        <td className="px-4 py-2">
          <Badge variant={cardType.active ? "success" : "neutral"}>{cardType.active ? "Da" : "Nu"}</Badge>
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
              label={cardType.active ? "Dezactivează" : "Activează"}
              variant={cardType.active ? "warning" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await toggleFidelityCardTypeActive(cardType.id, !cardType.active);
                    toast.success(cardType.active ? "Card dezactivat." : "Card activat.");
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
                if (!window.confirm(`Ștergi definitiv tipul de card „${cardType.name}"? Nu poate fi anulat.`)) return;
                startTransition(async () => {
                  const result = await deleteFidelityCardType(cardType.id);
                  if (result.ok) {
                    toast.success("Tip de card șters.");
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
              <TierEditor
                therapies={therapies}
                defaults={{ name: cardType.name, therapyId: cardType.therapy_id, tiers: cardType.tiers }}
              />
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
