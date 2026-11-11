"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOutOtherDevices } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { saveSidebarCollapsed } from "@/lib/uiPrefs";

/** "Ieși de pe celelalte dispozitive" — e.g. after using a shared computer. */
export function SignOutOthersButton({ otherDevices }: { otherDevices: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (otherDevices <= 0) {
    return <p className="text-sm text-zinc-500">Ești conectat doar de pe acest dispozitiv.</p>;
  }
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { signedOut } = await signOutOtherDevices();
          toast.success(signedOut === 1 ? "Am deconectat celălalt dispozitiv." : `Am deconectat ${signedOut} dispozitive.`);
          router.refresh();
        })
      }
    >
      <MonitorSmartphone size={16} />
      {pending ? "Se deconectează…" : `Ieși de pe ${otherDevices === 1 ? "celălalt dispozitiv" : `celelalte ${otherDevices} dispozitive`}`}
    </Button>
  );
}

/** Same setting as the toggle at the bottom of the menu, stated plainly. */
export function SidebarPreference({ collapsed }: { collapsed: boolean }) {
  const [value, setValue] = useState(collapsed);
  const router = useRouter();

  function choose(next: boolean) {
    setValue(next);
    saveSidebarCollapsed(next);
    router.refresh();
  }

  const option = (isCollapsed: boolean, label: string, hint: string, Icon: typeof PanelLeftOpen) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-[var(--mm-radius-md)] border px-3 py-2.5 transition-colors ${
        value === isCollapsed ? "border-[var(--mitmed-teal)] bg-[var(--mm-info-bg)]" : "border-[var(--mm-border)] hover:bg-zinc-50"
      }`}
    >
      <input type="radio" name="sidebar" className="sr-only" checked={value === isCollapsed} onChange={() => choose(isCollapsed)} />
      <Icon size={18} className="mt-0.5 shrink-0 text-[var(--mitmed-teal)]" />
      <span>
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Meniul lateral</legend>
      {option(false, "Meniu extins", "Iconițe și denumiri", PanelLeftOpen)}
      {option(true, "Meniu restrâns", "Doar iconițe, mai mult loc pentru pagină", PanelLeftClose)}
    </fieldset>
  );
}
