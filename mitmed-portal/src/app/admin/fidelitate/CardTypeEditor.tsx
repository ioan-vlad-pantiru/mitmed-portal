"use client";

import { useState } from "react";
import type { FidelityCardType } from "@/actions/fidelity";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { IconTrash } from "@/components/icons";

type Tier = { sessionNumber: string; discountPercent: string };

/** Editor pentru un tip de card: terapiile ale căror ședințe plătite se adună
 * pe același contor și un singur program de trepte pentru tot cardul (ex. a
 * 5-a ședință -25%, a 10-a -50%, oricare ar fi terapia). Terapiile se trimit
 * ca checkbox-uri, treptele ca JSON într-un input ascuns — vezi actions/fidelity.ts. */
export function CardTypeEditor({
  therapies,
  defaults,
}: {
  therapies: { id: string; name: string }[];
  defaults?: Pick<FidelityCardType, "name" | "therapies" | "tiers">;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaults?.therapies.map((t) => t.therapy_id) ?? (therapies[0] ? [therapies[0].id] : []))
  );
  const [tiers, setTiers] = useState<Tier[]>(
    defaults?.tiers.length
      ? defaults.tiers.map((t) => ({ sessionNumber: String(t.session_number), discountPercent: t.discount_percent }))
      : [{ sessionNumber: "5", discountPercent: "25" }]
  );

  // O terapie arhivată poate fi încă pe un card vechi — o arătăm ca să poată
  // fi debifată, chiar dacă nu mai e în catalog.
  const options = [
    ...therapies,
    ...(defaults?.therapies ?? [])
      .filter((t) => !therapies.some((c) => c.id === t.therapy_id))
      .map((t) => ({ id: t.therapy_id, name: t.therapy_name })),
  ];
  const allSelected = options.length > 0 && options.every((t) => selected.has(t.id));

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateTier(index: number, patch: Partial<Tier>) {
    setTiers((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    const nextSession = Math.max(0, ...tiers.map((t) => Number(t.sessionNumber) || 0)) + 1;
    setTiers((current) => [...current, { sessionNumber: String(nextSession), discountPercent: "" }]);
  }

  const tiersJson = JSON.stringify(
    tiers
      .filter((t) => t.sessionNumber && t.discountPercent)
      .map((t) => ({ session_number: Number(t.sessionNumber), discount_percent: Number(t.discountPercent) }))
  );

  return (
    <>
      <input type="hidden" name="tiersJson" value={tiersJson} />
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Nume card</label>
        <Input name="name" required defaultValue={defaults?.name} placeholder="ex: Card Fidelitate Recuperare" className="mt-1 sm:max-w-sm" />
      </div>

      <div className="col-span-2">
        <div className="flex items-baseline justify-between gap-2 sm:justify-start sm:gap-4">
          <label className="block text-xs font-medium text-zinc-700">Terapii incluse</label>
          <button
            type="button"
            onClick={() => setSelected(new Set(allSelected ? [] : options.map((t) => t.id)))}
            className="text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
          >
            {allSelected ? "Debifează toate" : "Bifează toate"}
          </button>
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">
          Ședințele plătite din oricare terapie bifată se adună pe același contor al cardului.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {options.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="therapyIds"
                value={t.id}
                checked={selected.has(t.id)}
                onChange={(e) => toggle(t.id, e.target.checked)}
                className="h-4 w-4 accent-[var(--mitmed-teal)]"
              />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Program de reduceri</label>
        <p className="mt-0.5 text-xs text-zinc-400">
          Ex: a 5-a ședință plătită -25%, a 10-a -50% — numărate din toate terapiile cardului. Ședințele fără treaptă sunt
          la preț întreg; programul se reia de la capăt după cea mai mare treaptă.
        </p>
        <div className="mt-2 space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
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
              <IconButton
                icon={IconTrash}
                label="Șterge treapta"
                variant="danger"
                onClick={() => setTiers((current) => current.filter((_, idx) => idx !== i))}
                disabled={tiers.length <= 1}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={addTier} className="mt-2 text-xs font-medium text-[var(--mitmed-teal)] hover:underline">
          + Adaugă treaptă
        </button>
      </div>
    </>
  );
}
