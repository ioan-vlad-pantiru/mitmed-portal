"use client";

import { useTransition } from "react";
import { cancelAppointment } from "@/actions/appointments";
import { useToast } from "@/components/Toast";

export function CancelAppointmentButton({ appointmentId, clientId }: { appointmentId: string; clientId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await cancelAppointment(appointmentId, clientId);
            toast.success("Programare anulată.");
          } catch {
            toast.error("Nu am putut anula programarea. Încearcă din nou.");
          }
        })
      }
      className="text-sm text-red-600 hover:underline disabled:opacity-60"
    >
      Anulează
    </button>
  );
}
