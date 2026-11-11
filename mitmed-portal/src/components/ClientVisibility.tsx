import { Eye, Lock } from "lucide-react";

/**
 * Tells staff, right where they type, whether the client will read this in
 * their portal ("Dosarul meu") or whether it stays inside the clinic.
 */
export function ClientVisibility({ visible }: { visible: boolean }) {
  return visible ? (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
      title="Apare în portalul clientului, la Dosarul meu"
    >
      <Eye size={12} aria-hidden /> Vede și clientul
    </span>
  ) : (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
      title="Rămâne doar în clinică; clientul nu vede"
    >
      <Lock size={11} aria-hidden /> Doar intern
    </span>
  );
}
