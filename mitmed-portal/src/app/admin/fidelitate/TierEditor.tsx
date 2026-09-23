"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { IconTrash } from "@/components/icons";

type Tier = { sessionNumber: string; discountPercent: string };

/** Editor pentru programul de trepte al unui card — ex. "a 5-a ședință
 * -25%, a 6-a -50%". Trimis ca JSON într-un input ascuns (`tiersJson`),
 * fiindcă lungimea listei e variabilă — vezi actions/fidelity.ts. */
export function TierEditor({
  therapies,
  defaults,
}: {
  therapies: { id: string; name: string }[];
  defaults?: {
    name?: string;
    therapyId?: string;
    tiers?: { session_number: number; discount_percent: string }[];
  };
}) {
  const [tiers, setTiers] = useState<Tier[]>(
    defaults?.tiers?.length
      ? defaults.tiers.map((t) => ({ sessionNumber: String(t.session_number), discountPercent: t.discount_percent }))
      : [{ sessionNumber: "5", discountPercent: "25" }]
  );

  function updateTier(index: number, patch: Partial<Tier>) {
    setTiers((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    const nextSession = Math.max(0, ...tiers.map((t) => Number(t.sessionNumber) || 0)) + 1;
    setTiers((current) => [...current, { sessionNumber: String(nextSession), discountPercent: "" }]);
  }

  function removeTier(index: number) {
    setTiers((current) => current.filter((_, i) => i !== index));
  }

  const tiersJson = JSON.stringify(
    tiers
      .filter((t) => t.sessionNumber && t.discountPercent)
      .map((t) => ({ session_number: Number(t.sessionNumber), discount_percent: Number(t.discountPercent) }))
  );

  return (
    <>
      <input type="hidden" name="tiersJson" value={tiersJson} />
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Nume card</label>
        <Input name="name" required defaultValue={defaults?.name} placeholder="ex: Card Fidelitate Masaj" className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Terapie</label>
        <Select name="therapyId" required defaultValue={defaults?.therapyId} className="mt-1">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Program de reduceri</label>
        <p className="mt-0.5 text-xs text-zinc-400">
          Ex: a 5-a ședință plătită -25%, a 6-a -50%. Ședințele fără treaptă definită sunt la preț întreg. Programul se
          reia de la capăt după cea mai mare treaptă.
        </p>
        <div className="mt-2 space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">a</span>
              <Input
                type="number"
                min={1}
                value={tier.sessionNumber}
                onChange={(e) => updateTier(i, { sessionNumber: e.target.value })}
                className="w-16"
                aria-label="Numărul ședinței"
              />
              <span className="text-xs text-zinc-500">-a ședință plătită →</span>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={tier.discountPercent}
                onChange={(e) => updateTier(i, { discountPercent: e.target.value })}
                className="w-20"
                aria-label="Procent reducere"
              />
              <span className="text-xs text-zinc-500">%</span>
              <IconButton icon={IconTrash} label="Șterge treapta" variant="danger" onClick={() => removeTier(i)} disabled={tiers.length <= 1} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTier}
          className="mt-2 text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
        >
          + Adaugă treaptă
        </button>
      </div>
    </>
  );
}
