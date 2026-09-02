"use client";

import { useTransition } from "react";
import { toggleCouponActive } from "@/actions/coupons";
import { useToast } from "@/components/Toast";

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
  therapies: string[];
};

export function CouponRow({ coupon }: { coupon: Coupon }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const period = [
    coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString("ro-RO") : null,
    coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString("ro-RO") : null,
  ]
    .filter(Boolean)
    .join(" – ") || "oricând";

  return (
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
      <td className="px-4 py-2 text-zinc-600">{coupon.therapies.length ? coupon.therapies.join(", ") : "toate"}</td>
      <td className="px-4 py-2">
        <span className={coupon.active ? "text-emerald-600" : "text-zinc-400"}>{coupon.active ? "Da" : "Nu"}</span>
      </td>
      <td className="px-4 py-2 text-right">
        <button
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
          className="text-sm text-sky-600 hover:underline disabled:opacity-60"
        >
          {coupon.active ? "Dezactivează" : "Activează"}
        </button>
      </td>
    </tr>
  );
}
