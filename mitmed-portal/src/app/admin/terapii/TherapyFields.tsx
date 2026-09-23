import { Input, Textarea } from "@/components/ui/Input";

export function TherapyFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    price?: string | number;
    isConsultation?: boolean;
  };
}) {
  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Nume</label>
        <Input name="name" required defaultValue={defaults?.name} className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Durată (minute)</label>
        <Input
          name="durationMinutes"
          type="number"
          min={1}
          required
          defaultValue={defaults?.durationMinutes}
          className="mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Preț (RON)</label>
        <Input
          name="price"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={defaults?.price}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Preț pentru o ședință unică. Pentru pachete cu mai multe ședințe, vezi{" "}
          <a href="/admin/pachete" className="text-sky-600 hover:underline">
            Pachete
          </a>
          .
        </p>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-zinc-700">Descriere (opțional)</label>
        <Textarea name="description" rows={2} defaultValue={defaults?.description ?? ""} className="mt-1" />
      </div>
      <div className="col-span-2">
        <label className="flex items-start gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            name="isConsultation"
            defaultChecked={defaults?.isConsultation ?? false}
            className="mt-0.5"
          />
          <span>
            <strong className="block font-medium">Este o consultație</strong>
            Rezervabilă liber de orice client din portal, chiar dacă medicul nu i-a deblocat încă alte terapii. Un
            client nou vede doar terapiile marcate astfel, până e deblocat pentru restul.
          </span>
        </label>
      </div>
    </>
  );
}
