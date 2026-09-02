"use client";

import { useActionState } from "react";
import { createCoupon } from "@/actions/coupons";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string };

export function CouponForm({ therapies }: { therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createCoupon, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-3xl grid-cols-2 gap-3 mm-card p-4">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Cod</label>
        <Input name="code" required className="mt-1 uppercase" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Tip</label>
        <Select name="type" className="mt-1">
          <option value="PROCENT">Procent (%)</option>
          <option value="FIX">Sumă fixă (RON)</option>
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valoare</label>
        <Input name="value" type="number" step="0.01" min={0} required className="mt-1" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Utilizări maxime (opțional)</label>
        <Input name="maxUses" type="number" min={1} className="mt-1" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valabil de la (opțional)</label>
        <Input name="validFrom" type="date" className="mt-1" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valabil până la (opțional)</label>
        <Input name="validUntil" type="date" className="mt-1" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">
          Restricționează la terapii (opțional — lasă gol pentru toate)
        </label>
        <Select name="therapyIds" multiple className="mt-1 h-24">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}

      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Adaugă cupon"}
        </Button>
      </div>
    </form>
  );
}
