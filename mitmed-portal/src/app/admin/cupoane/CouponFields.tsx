import { Input, Select } from "@/components/ui/Input";

type Therapy = { id: string; name: string };

export function CouponFields({
  therapies,
  defaults,
}: {
  therapies: Therapy[];
  defaults?: {
    code?: string;
    type?: string;
    value?: string | number;
    validFrom?: string | null;
    validUntil?: string | null;
    maxUses?: number | null;
    selectedTherapyIds?: string[];
  };
}) {
  // Gol = "toate terapiile" — comportament existent, păstrat.
  const selected = new Set(defaults?.selectedTherapyIds ?? []);

  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Cod</label>
        <Input name="code" required defaultValue={defaults?.code} className="mt-1 uppercase" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Tip</label>
        <Select name="type" defaultValue={defaults?.type ?? "PROCENT"} className="mt-1">
          <option value="PROCENT">Procent (%)</option>
          <option value="FIX">Sumă fixă (RON)</option>
        </Select>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Valoare</label>
        <Input name="value" type="number" step="0.01" min={0} required defaultValue={defaults?.value} className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Utilizări maxime (opțional)</label>
        <Input name="maxUses" type="number" min={1} defaultValue={defaults?.maxUses ?? undefined} className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Valabil de la (opțional)</label>
        <Input name="validFrom" type="date" defaultValue={defaults?.validFrom ?? undefined} className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Valabil până la (opțional)</label>
        <Input name="validUntil" type="date" defaultValue={defaults?.validUntil ?? undefined} className="mt-1" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">
          Restricționează la terapii <span className="font-normal text-zinc-400">(nicio bifă = toate)</span>
        </label>
        <div className="mt-1 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-zinc-300 p-2 sm:grid-cols-2">
          {therapies.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-zinc-50">
              <input
                type="checkbox"
                name="therapyIds"
                value={t.id}
                defaultChecked={selected.has(t.id)}
                className="h-4 w-4 rounded border-zinc-300 text-[var(--mitmed-teal)] focus:ring-[var(--mitmed-sky)]"
              />
              <span className="text-zinc-700">{t.name}</span>
            </label>
          ))}
          {therapies.length === 0 && <p className="col-span-2 text-sm text-zinc-400">Nicio terapie definită încă.</p>}
        </div>
      </div>
    </>
  );
}
