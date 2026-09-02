"use client";

import { useActionState, useState, useTransition } from "react";
import { togglePackageActive, updatePackage, type TherapyPackage } from "@/actions/packages";
import { PackageFields } from "./PackageFields";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Therapy = { id: string; name: string };

export function PackageRow({ pkg, therapies }: { pkg: TherapyPackage; therapies: Therapy[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = updatePackage.bind(null, pkg.id);
  const [state, action, saving] = useActionState(updateAction, undefined);
  const toast = useToast();

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
        <td className="px-4 py-2 text-zinc-600">{pkg.price} RON</td>
        <td className="px-4 py-2">
          <Badge variant={pkg.active ? "success" : "neutral"}>{pkg.active ? "Da" : "Nu"}</Badge>
        </td>
        <td className="px-4 py-2 text-right whitespace-nowrap">
          <button onClick={() => setEditing((v) => !v)} className="mr-3 text-sm text-sky-600 hover:underline">
            {editing ? "Renunță" : "Editează"}
          </button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await togglePackageActive(pkg.id, !pkg.active);
                  toast.success(pkg.active ? "Pachet dezactivat." : "Pachet activat.");
                } catch {
                  toast.error("Nu am putut schimba statusul. Încearcă din nou.");
                }
              })
            }
            className="text-sm text-sky-600 hover:underline disabled:opacity-60"
          >
            {pkg.active ? "Dezactivează" : "Activează"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-zinc-50/60 px-4 py-4">
            <form action={action} className="grid max-w-2xl grid-cols-2 gap-3">
              <PackageFields therapies={therapies} defaults={{ name: pkg.name, price: pkg.price, items: pkg.items }} />
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
