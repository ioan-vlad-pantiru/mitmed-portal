"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCoupon, toggleCouponActive, updateCoupon } from "@/actions/coupons";
import { CouponFields } from "./CouponFields";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconEdit, IconPower, IconTrash, IconClose } from "@/components/icons";

type Therapy = { id: string; name: string };

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: string;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usesCount: number;
  active: boolean;
  therapies: Therapy[];
};

export function CouponRow({ coupon, allTherapies }: { coupon: Coupon; allTherapies: Therapy[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = updateCoupon.bind(null, coupon.id);
  const [state, action, saving] = useActionState(updateAction, undefined);
  const toast = useToast();

  const period = [
    coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString("ro-RO") : null,
    coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString("ro-RO") : null,
  ]
    .filter(Boolean)
    .join(" – ") || "oricând";

  return (
    <>
      <tr className="transition-colors hover:bg-zinc-50/70">
        <td className="px-4 py-2 font-mono text-zinc-900">{coupon.code}</td>
        <td className="px-4 py-2 text-zinc-600">
          {coupon.value} {coupon.type === "PROCENT" ? "%" : "RON"}
        </td>
        <td className="px-4 py-2 text-zinc-600">{period}</td>
        <td className="px-4 py-2 text-zinc-600">
          {coupon.usesCount}
          {coupon.maxUses ? ` / ${coupon.maxUses}` : ""}
        </td>
        <td className="px-4 py-2 text-zinc-600">
          {coupon.therapies.length ? coupon.therapies.map((t) => t.name).join(", ") : "toate"}
        </td>
        <td className="px-4 py-2">
          <Badge variant={coupon.active ? "success" : "neutral"}>{coupon.active ? "Da" : "Nu"}</Badge>
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
              label={coupon.active ? "Dezactivează" : "Activează"}
              variant={coupon.active ? "warning" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await toggleCouponActive(coupon.id, !coupon.active);
                    toast.success(coupon.active ? "Cupon dezactivat." : "Cupon activat.");
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
                if (!window.confirm(`Ștergi definitiv cuponul „${coupon.code}"? Nu poate fi anulat.`)) return;
                startTransition(async () => {
                  const result = await deleteCoupon(coupon.id);
                  if (result.ok) {
                    toast.success("Cupon șters.");
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
          <td colSpan={7} className="bg-zinc-50/60 px-4 py-4">
            <form action={action} className="grid max-w-3xl grid-cols-2 gap-3">
              <CouponFields
                therapies={allTherapies}
                defaults={{
                  code: coupon.code,
                  type: coupon.type,
                  value: coupon.value,
                  validFrom: coupon.validFrom ? coupon.validFrom.slice(0, 10) : null,
                  validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 10) : null,
                  maxUses: coupon.maxUses,
                  selectedTherapyIds: coupon.therapies.map((t) => t.id),
                }}
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
