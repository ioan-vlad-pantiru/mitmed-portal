"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOwnAppointment } from "@/actions/appointments";
import { useToast } from "@/components/Toast";

const MIN_CANCEL_NOTICE_MS = 48 * 60 * 60 * 1000;

export function CancelOwnAppointmentButton({
  appointmentId,
  startsAt,
  variant = "light",
}: {
  appointmentId: string;
  startsAt: string;
  /** "light" = pe fundal teal (hero), "default" = pe fundal alb (listă). */
  variant?: "light" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const [now] = useState(() => Date.now());

  // Doar afișaj — regula reală e verificată pe backend la fiecare cerere.
  const tooLateToCancel = new Date(startsAt).getTime() - now < MIN_CANCEL_NOTICE_MS;

  if (tooLateToCancel) {
    return (
      <span className={`text-xs ${variant === "light" ? "text-[var(--mitmed-mist)]/60" : "text-zinc-400"}`}>
        Nu se mai poate anula (sub 48h) — anunță cabinetul telefonic dacă nu poți ajunge
      </span>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Sigur anulezi această programare?")) return;
        startTransition(async () => {
          const result = await cancelOwnAppointment(appointmentId);
          if (result.ok) {
            toast.success("Programare anulată.");
            router.refresh();
          } else {
            toast.error(result.message);
          }
        });
      }}
      className={`text-xs font-medium underline-offset-2 hover:underline disabled:opacity-60 ${
        variant === "light" ? "text-[var(--mitmed-mist)]/85" : "text-red-600"
      }`}
    >
      Anulează
    </button>
  );
}
