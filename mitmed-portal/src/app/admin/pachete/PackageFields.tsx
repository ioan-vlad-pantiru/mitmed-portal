"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/icons";

type Therapy = { id: string; name: string };
type Line = { therapyId: string; sessions: number };

export function PackageFields({
  therapies,
  defaults,
}: {
  therapies: Therapy[];
  defaults?: { name?: string; price?: string | number; items?: { therapy_id: string; sessions_included: number }[] };
}) {
  const [lines, setLines] = useState<Line[]>(
    defaults?.items && defaults.items.length > 0
      ? defaults.items.map((i) => ({ therapyId: i.therapy_id, sessions: i.sessions_included }))
      : [{ therapyId: therapies[0]?.id ?? "", sessions: 1 }]
  );

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    // Prima terapie neinclusă încă, dacă există — evită să adaugi din start
    // aceeași terapie de două ori într-un pachet nou.
    const used = new Set(lines.map((l) => l.therapyId));
    const next = therapies.find((t) => !used.has(t.id)) ?? therapies[0];
    setLines((prev) => [...prev, { therapyId: next?.id ?? "", sessions: 1 }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Nume pachet</label>
        <Input name="name" required defaultValue={defaults?.name} className="mt-1" placeholder="ex. Pachet Recuperare" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Preț total pachet (RON)</label>
        <Input name="price" type="number" step="0.01" min={0} required defaultValue={defaults?.price} className="mt-1" />
        <p className="mt-1 text-xs text-zinc-400">De obicei mai mic decât suma terapiilor incluse, separat.</p>
      </div>

      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Terapii incluse</label>
        <div className="mt-1 space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={line.therapyId}
                onChange={(e) => updateLine(idx, { therapyId: e.target.value })}
                className="min-w-0 flex-1"
              >
                {therapies.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                value={line.sessions}
                onChange={(e) => updateLine(idx, { sessions: Number(e.target.value) })}
                className="w-24 shrink-0"
                aria-label="Ședințe"
              />
              <span className="shrink-0 text-xs text-zinc-400">ședințe</span>
              <button
                type="button"
                onClick={() => removeLine(idx)}
                disabled={lines.length === 1}
                aria-label="Șterge linia"
                className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-red-600 disabled:opacity-30"
              >
                <IconClose className="h-4 w-4" />
              </button>
              {/* Câmpurile reale trimise la submit — sincronizate cu starea de mai sus. */}
              <input type="hidden" name="itemTherapyId" value={line.therapyId} />
              <input type="hidden" name="itemSessions" value={line.sessions} />
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-2 text-xs" onClick={addLine}>
          + Adaugă terapie
        </Button>
      </div>
    </>
  );
}
