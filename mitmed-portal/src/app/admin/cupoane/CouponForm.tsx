"use client";

import { useActionState } from "react";
import { createCoupon } from "@/actions/coupons";

type Therapy = { id: string; name: string };

export function CouponForm({ therapies }: { therapies: Therapy[] }) {
  const [state, action, pending] = useActionState(createCoupon, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-3xl grid-cols-2 gap-3 mm-card p-4">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Cod</label>
        <input name="code" required className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm uppercase" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Tip</label>
        <select name="type" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
          <option value="PROCENT">Procent (%)</option>
          <option value="FIX">Sumă fixă (RON)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valoare</label>
        <input
          name="value"
          type="number"
          step="0.01"
          min={0}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Utilizări maxime (opțional)</label>
        <input name="maxUses" type="number" min={1} className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valabil de la (opțional)</label>
        <input name="validFrom" type="date" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Valabil până la (opțional)</label>
        <input name="validUntil" type="date" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">
          Restricționează la terapii (opțional — lasă gol pentru toate)
        </label>
        <select
          name="therapyIds"
          multiple
          className="mt-1 h-24 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Adaugă cupon"}
        </button>
      </div>
    </form>
  );
}
