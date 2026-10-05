"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAppointment } from "@/actions/appointments";
import { useToast } from "@/components/Toast";

const MIN_CANCEL_NOTICE_MS = 48 * 60 * 60 * 1000;

export function CancelAppointmentButton({
  appointmentId,
  clientId,
  startsAt,
  isAdmin = false,
}: {
  appointmentId: string;
  clientId: string;
  startsAt: string;
  /** Adminul poate anula oricând, inclusiv sub 48h. */
  isAdmin?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  // Date.now() e impur — inițializatorul lazy al useState e excepția
  // sancționată (rulează o singură dată, la montare).
  const [now] = useState(() => Date.now());

  // Doar afișaj — regula reală e verificată pe backend la fiecare cerere,
  // ca sursă de adevăr. Aici doar evităm un click care oricum ar eșua.
  const tooLateToCancel = new Date(startsAt).getTime() - now < MIN_CANCEL_NOTICE_MS;

  if (tooLateToCancel && !isAdmin) {
    return <span className="text-xs text-zinc-400">Nu se mai poate anula (sub 48h)</span>;
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelAppointment(appointmentId, clientId);
          if (result.ok) {
            toast.success("Programare anulată.");
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
      className="text-sm text-red-600 hover:underline disabled:opacity-60"
    >
      Anulează
    </button>
  );
}
