import type { ComponentType, ReactNode } from "react";
import { ClientVisibility } from "@/components/ClientVisibility";

/** One block of the Consult sheet: a card with icon, title and hint. Every
 * section (SOAP, therapies, body map, extra fields) shares this header. */
export function ConsultSection({
  icon: Icon,
  title,
  hint,
  aside,
  visibility,
  children,
}: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  title: string;
  hint?: string;
  /** Control placed at the right of the header (e.g. the diagnosis field). */
  aside?: ReactNode;
  /** Whether the client reads this section in their portal. */
  visibility?: "client" | "internal";
  children: ReactNode;
}) {
  return (
    <section className="mm-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mm-info-bg)] text-[var(--mitmed-teal)]">
            <Icon size={18} aria-hidden />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
              {title}
              {visibility && <ClientVisibility visible={visibility === "client"} />}
            </h2>
            {hint && <p className="text-xs text-zinc-500">{hint}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The Consult save bar: stuck to the bottom as a floating pill over the
 * content, within reach however long the sheet gets. */
export function ConsultActionBar({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 pb-1 pt-2">
      <div className="mm-card flex items-center justify-between gap-3 px-4 py-2.5 shadow-[var(--mm-shadow-lg)]">
        <span className="hidden text-xs text-zinc-500 sm:inline">{hint}</span>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
