type Therapy = { id: string; name: string };

/** Bifarea uneia sau mai multor terapii făcute în aceeași ședință. Trimite
 * `therapyIds` (câte unul per bifă) și markerul `therapyIdsField`, ca acțiunea
 * să știe că lista a fost trimisă (și o listă goală înseamnă „nicio terapie”). */
export function TherapyCheckboxes({
  therapies,
  selected = [],
  hideLegend = false,
}: {
  therapies: Therapy[];
  selected?: string[];
  /** Keep the legend for screen readers only when a visible heading already says it. */
  hideLegend?: boolean;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "block text-xs font-medium text-zinc-700"}>Terapii efectuate (poți bifa mai multe)</legend>
      <input type="hidden" name="therapyIdsField" value="1" />
      <div className={`flex flex-wrap gap-2 ${hideLegend ? "" : "mt-1.5"}`}>
        {therapies.map((t) => (
          <label
            key={t.id}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--mm-border-strong)] bg-white px-3.5 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-[var(--mm-surface-muted)] has-[:checked]:border-[var(--mitmed-teal)] has-[:checked]:bg-[var(--mm-info-bg)] has-[:checked]:font-medium has-[:checked]:text-[var(--mitmed-teal-deep)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--mitmed-sky)]"
          >
            <input type="checkbox" name="therapyIds" value={t.id} defaultChecked={selected.includes(t.id)} className="h-4 w-4 accent-[var(--mitmed-teal)]" />
            {t.name}
          </label>
        ))}
        {therapies.length === 0 && <p className="text-sm text-zinc-400">Nicio terapie activă.</p>}
      </div>
    </fieldset>
  );
}
