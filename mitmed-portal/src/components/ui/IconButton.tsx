import type { ButtonHTMLAttributes, ComponentType } from "react";

type Variant = "neutral" | "primary" | "warning" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
  primary: "text-[var(--mitmed-teal)] hover:bg-[var(--mitmed-sky)]/12",
  warning: "text-amber-600 hover:bg-amber-50",
  danger: "text-red-600 hover:bg-red-50",
};

/** Buton compact, doar-iconiță, pentru acțiuni de rând în tabele (Editează /
 * Dezactivează / Șterge) — înlocuiește link-urile de text subliniate cu ceva
 * care arată ca un buton real, cu target de click generos și tooltip nativ. */
export function IconButton({
  icon: Icon,
  label,
  variant = "neutral",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ComponentType<{ className?: string }>;
  label: string;
  variant?: Variant;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
