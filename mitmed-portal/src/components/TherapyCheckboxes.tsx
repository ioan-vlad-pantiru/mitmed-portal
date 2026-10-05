type Therapy = { id: string; name: string };

/** Bifarea uneia sau mai multor terapii făcute în aceeași ședință. Trimite
 * `therapyIds` (câte unul per bifă) și markerul `therapyIdsField`, ca acțiunea
 * să știe că lista a fost trimisă (și o listă goală înseamnă „nicio terapie”). */
export function TherapyCheckboxes({ therapies, selected = [] }: { therapies: Therapy[]; selected?: string[] }) {
  return (
    <fieldset>
      <legend className="block text-xs font-medium text-zinc-700">Terapii efectuate (poți bifa mai multe)</legend>
      <input type="hidden" name="therapyIdsField" value="1" />
      <div className="mt-1 flex flex-wrap gap-2">
        {therapies.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 has-[:checked]:border-[var(--mitmed-teal)] has-[:checked]:bg-[var(--mm-info-bg)] has-[:checked]:text-[var(--mitmed-teal-deep)]"
          >
            <input type="checkbox" name="therapyIds" value={t.id} defaultChecked={selected.includes(t.id)} className="accent-[var(--mitmed-teal)]" />
            {t.name}
          </label>
        ))}
        {therapies.length === 0 && <p className="text-sm text-zinc-400">Nicio terapie activă.</p>}
      </div>
    </fieldset>
  );
}
