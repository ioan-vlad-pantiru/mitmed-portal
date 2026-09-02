"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { IconClose } from "@/components/icons";

/** Dialog modal — wrapper subțire peste @radix-ui/react-dialog (focus trap și
 * accesibilitate gratis), stilizat 100% cu tokens proprii (--mm-radius/shadow). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-zinc-900/40 data-[state=open]:animate-[toast-in_0.15s_ease-out]" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--mm-radius-lg)] bg-white p-5 shadow-[var(--mm-shadow-lg)] focus:outline-none"
          aria-describedby={description ? "mm-dialog-description" : undefined}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-zinc-900">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description id="mm-dialog-description" className="mt-0.5 text-sm text-zinc-500">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                aria-label="Închide"
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
