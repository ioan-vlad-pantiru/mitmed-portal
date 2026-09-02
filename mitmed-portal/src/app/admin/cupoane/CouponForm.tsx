"use client";

import { useActionState } from "react";
import { createCoupon } from "@/actions/coupons";
import { CouponFields } from "./CouponFields";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string };

export function CouponForm({ therapies }: { therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createCoupon, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-3xl grid-cols-2 gap-3 mm-card p-4">
      <CouponFields therapies={therapies} />

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}

      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Adaugă cupon"}
        </Button>
      </div>
    </form>
  );
}
