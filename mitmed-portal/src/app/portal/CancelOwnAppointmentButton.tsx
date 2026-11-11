"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOwnAppointment } from "@/actions/appointments";
import { useToast } from "@/components/Toast";
import { CLINIC_PHONE, CLINIC_PHONE_HREF } from "@/lib/clinic";

const MIN_CANCEL_NOTICE_MS = 48 * 60 * 60 * 1000;

/** Cancel with an inline "are you sure?" step — no browser pop-up, hard to trigger by mistake. */
export function CancelOwnAppointmentButton({
  appointmentId,
  startsAt,
  variant = "light",
}: {
  appointmentId: string;
  startsAt: string;
  /** "light" = on the dark teal card, "default" = on white. */
  variant?: "light" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const light = variant === "light";

  // Display only — the backend enforces the real rule on every request.
  if (new Date(startsAt).getTime() - now < MIN_CANCEL_NOTICE_MS) {
    return (
      <span className={`text-sm ${light ? "text-[var(--mitmed-mist)]/80" : "text-[#55706f]"}`}>
        Nu mai poți anula online (sub 48 de ore). Dacă nu poți ajunge, sună la{" "}
        <a href={CLINIC_PHONE_HREF} className="font-semibold underline">
          {CLINIC_PHONE}
        </a>
        .
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm">
        <span className={light ? "text-white" : "text-[#284747]"}>Sigur anulezi?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelOwnAppointment(appointmentId);
              if (result.ok) {
                toast.success("Programarea a fost anulată.");
                router.refresh();
              } else {
                toast.error(result.message);
                setConfirming(false);
              }
            })
          }
          className="min-h-10 rounded-full bg-[var(--mm-danger)] px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Se anulează…" : "Da, anulează"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={`min-h-10 rounded-full px-4 font-semibold ${light ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Nu
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`min-h-10 text-sm font-semibold underline underline-offset-4 ${light ? "text-[var(--mitmed-mist)]/90" : "text-[var(--mm-danger)]"}`}
    >
      Anulează programarea
    </button>
  );
}
