import type { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "neutral";

export function Badge({ variant = "neutral", children }: { variant?: Variant; children: ReactNode }) {
  return (
    <span data-variant={variant} className="mm-badge">
      {children}
    </span>
  );
}
