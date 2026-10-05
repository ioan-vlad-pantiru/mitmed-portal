"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePackage, togglePackageActive, updatePackage, type TherapyPackage } from "@/actions/packages";
import { PackageFields } from "./PackageFields";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconEdit, IconPower, IconTrash, IconClose } from "@/components/icons";

type Therapy = { id: string; name: string; price: string };

export function PackageRow({ pkg, therapies }: { pkg: TherapyPackage; therapies: Therapy[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = updatePackage.bind(null, pkg.id);
  const [state, action, saving] = useActionState(updateAction, undefined);
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <tr className="transition-colors hover:bg-zinc-50/70">
        <td className="px-4 py-2 text-zinc-900">{pkg.name}</td>
        <td className="px-4 py-2 text-zinc-600">
          <ul className="space-y-0.5">
            {pkg.items.map((i) => (
              <li key={i.therapy_id}>
                {i.sessions_included}× {i.therapy_name}
              </li>
            ))}
          </ul>
        </td>
        <td className="px-4 py-2 text-zinc-600">{pkg.discount_percent}%</td>
        <td className="px-4 py-2 text-zinc-600">
          {pkg.price} RON
          {pkg.price_override !== null && (
            <span className="block text-xs text-zinc-400">editat manual (calculat: {pkg.computed_price} RON)</span>
          )}
        </td>
        <td className="px-4 py-2">
          <Badge variant={pkg.active ? "success" : "neutral"}>{pkg.active ? "Da" : "Nu"}</Badge>
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
              label={pkg.active ? "Dezactivează" : "Activează"}
              variant={pkg.active ? "warning" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await togglePackageActive(pkg.id, !pkg.active);
                    toast.success(pkg.active ? "Pachet dezactivat." : "Pachet activat.");
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
                    `Ștergi pachetul „${pkg.name}"? Nu mai poate fi vândut. Clienții care l-au cumpărat deja își păstrează ședințele rămase.`
                  )
                )
                  return;
                startTransition(async () => {
                  const result = await deletePackage(pkg.id);
                  if (result.ok) {
                    toast.success(result.archived ? "Pachet șters din catalog (achizițiile rămân)." : "Pachet șters.");
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
          <td colSpan={6} className="bg-zinc-50/60 px-4 py-4">
            <form action={action} className="grid max-w-2xl grid-cols-2 gap-3">
              <PackageFields
                therapies={therapies}
                defaults={{ name: pkg.name, discountPercent: pkg.discount_percent, priceOverride: pkg.price_override, items: pkg.items }}
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
