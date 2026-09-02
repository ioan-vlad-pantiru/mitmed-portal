export function TherapyFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    price?: string | number;
    sessionsIncluded?: number;
  };
}) {
  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Nume</label>
        <input
          name="name"
          required
          defaultValue={defaults?.name}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Durată (minute)</label>
        <input
          name="durationMinutes"
          type="number"
          min={1}
          required
          defaultValue={defaults?.durationMinutes}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Preț total (RON)</label>
        <input
          name="price"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={defaults?.price}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-400">Dacă e pachet, prețul e al pachetului întreg.</p>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Ședințe incluse</label>
        <input
          name="sessionsIncluded"
          type="number"
          min={1}
          required
          defaultValue={defaults?.sessionsIncluded ?? 1}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-400">1 = ședință unică · &gt;1 = pachet de mai multe ședințe.</p>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Descriere (opțional)</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={defaults?.description ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
    </>
  );
}
