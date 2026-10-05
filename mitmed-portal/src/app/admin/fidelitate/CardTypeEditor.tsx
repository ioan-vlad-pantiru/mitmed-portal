"use client";

import { useState } from "react";
import type { FidelityCardTherapy } from "@/actions/fidelity";
import { Input, Select } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { IconTrash } from "@/components/icons";

type Tier = { sessionNumber: string; discountPercent: string };
type TherapyBlock = { therapyId: string; tiers: Tier[] };

const DEFAULT_TIERS: Tier[] = [{ sessionNumber: "5", discountPercent: "25" }];

/** Editor pentru un tip de card: una sau mai multe terapii, fiecare cu
 * propriul program de trepte (ex. Masaj: a 5-a ședință -25%; Kinetoterapie:
 * a 10-a -50%) și propriul contor pe cardul clientului. Trimis ca JSON într-un
 * input ascuns (`therapiesJson`) — vezi actions/fidelity.ts. */
export function CardTypeEditor({
  therapies,
  defaults,
}: {
  therapies: { id: string; name: string }[];
  defaults?: { name?: string; therapies?: FidelityCardTherapy[] };
}) {
  const [blocks, setBlocks] = useState<TherapyBlock[]>(
    defaults?.therapies?.length
      ? defaults.therapies.map((t) => ({
          therapyId: t.therapy_id,
          tiers: t.tiers.map((tier) => ({ sessionNumber: String(tier.session_number), discountPercent: tier.discount_percent })),
        }))
      : [{ therapyId: therapies[0]?.id ?? "", tiers: DEFAULT_TIERS }]
  );

  function updateBlock(index: number, patch: Partial<TherapyBlock>) {
    setBlocks((current) => current.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function updateTier(blockIndex: number, tierIndex: number, patch: Partial<Tier>) {
    const block = blocks[blockIndex];
    updateBlock(blockIndex, { tiers: block.tiers.map((t, i) => (i === tierIndex ? { ...t, ...patch } : t)) });
  }

  function addTier(blockIndex: number) {
    const block = blocks[blockIndex];
    const nextSession = Math.max(0, ...block.tiers.map((t) => Number(t.sessionNumber) || 0)) + 1;
    updateBlock(blockIndex, { tiers: [...block.tiers, { sessionNumber: String(nextSession), discountPercent: "" }] });
  }

  function addTherapy() {
    const used = new Set(blocks.map((b) => b.therapyId));
    const next = therapies.find((t) => !used.has(t.id));
    if (!next) return;
    setBlocks((current) => [...current, { therapyId: next.id, tiers: DEFAULT_TIERS }]);
  }

  function addAllTherapies() {
    const used = new Set(blocks.map((b) => b.therapyId));
    const missing = therapies.filter((t) => !used.has(t.id));
    // Fiecare terapie nouă pornește cu programul primei terapii de pe card,
    // ca "toate terapiile, același prag" să fie un singur click.
    const template = blocks[0]?.tiers ?? DEFAULT_TIERS;
    setBlocks((current) => [...current, ...missing.map((t) => ({ therapyId: t.id, tiers: template.map((tier) => ({ ...tier })) }))]);
  }

  const therapiesJson = JSON.stringify(
    blocks.map((b) => ({
      therapy_id: b.therapyId,
      tiers: b.tiers
        .filter((t) => t.sessionNumber && t.discountPercent)
        .map((t) => ({ session_number: Number(t.sessionNumber), discount_percent: Number(t.discountPercent) })),
    }))
  );
  const usedTherapyIds = new Set(blocks.map((b) => b.therapyId));

  return (
    <>
      <input type="hidden" name="therapiesJson" value={therapiesJson} />
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Nume card</label>
        <Input name="name" required defaultValue={defaults?.name} placeholder="ex: Card Fidelitate Recuperare" className="mt-1 sm:max-w-sm" />
      </div>

      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Terapii și praguri de reducere</label>
        <p className="mt-0.5 text-xs text-zinc-400">
          Fiecare terapie își numără separat ședințele plătite. Ex: a 5-a ședință de masaj -25%. Ședințele fără treaptă
          sunt la preț întreg; programul fiecărei terapii se reia după cea mai mare treaptă a ei.
        </p>
        <div className="mt-2 space-y-3">
          {blocks.map((block, bi) => (
            <div key={bi} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={block.therapyId}
                  onChange={(e) => updateBlock(bi, { therapyId: e.target.value })}
                  className="min-w-0 flex-1 sm:max-w-xs"
                  aria-label="Terapie"
                >
                  {therapies
                    .filter((t) => t.id === block.therapyId || !usedTherapyIds.has(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </Select>
                <IconButton
                  icon={IconTrash}
                  label="Scoate terapia de pe card"
                  variant="danger"
                  onClick={() => setBlocks((current) => current.filter((_, i) => i !== bi))}
                  disabled={blocks.length <= 1}
                />
              </div>
              <div className="mt-2 space-y-2">
                {block.tiers.map((tier, ti) => (
                  <div key={ti} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">a</span>
                    <Input
                      type="number"
                      min={1}
                      value={tier.sessionNumber}
                      onChange={(e) => updateTier(bi, ti, { sessionNumber: e.target.value })}
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
                      onChange={(e) => updateTier(bi, ti, { discountPercent: e.target.value })}
                      className="w-20"
                      aria-label="Procent reducere"
                    />
                    <span className="text-xs text-zinc-500">%</span>
                    <IconButton
                      icon={IconTrash}
                      label="Șterge treapta"
                      variant="danger"
                      onClick={() => updateBlock(bi, { tiers: block.tiers.filter((_, i) => i !== ti) })}
                      disabled={block.tiers.length <= 1}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addTier(bi)}
                className="mt-2 text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
              >
                + Adaugă treaptă
              </button>
            </div>
          ))}
        </div>
        {blocks.length < therapies.length && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={addTherapy}
              className="text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
            >
              + Adaugă încă o terapie pe card
            </button>
            <button
              type="button"
              onClick={addAllTherapies}
              className="text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
            >
              + Adaugă toate terapiile (cu pragurile primei terapii)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
