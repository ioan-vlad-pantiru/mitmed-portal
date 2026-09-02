"use client";

import { useTransition } from "react";
import Link from "next/link";
import { markBookingRequestConfirmed, rejectBookingRequest, type BookingRequest } from "@/actions/publicBookings";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function BookingRequestRow({ request, readonly }: { request: BookingRequest; readonly?: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <div className="mm-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-900">{request.full_name}</p>
          <p className="text-zinc-500">
            {request.phone}
            {request.email ? ` · ${request.email}` : ""}
          </p>
          {request.therapy_name && <p className="mt-1 text-zinc-600">Terapie dorită: {request.therapy_name}</p>}
          {request.preferred_starts_at && (
            <p className="text-zinc-600">
              Preferă: {new Date(request.preferred_starts_at).toLocaleString("ro-RO")}
            </p>
          )}
          {request.message && <p className="mt-1 whitespace-pre-wrap text-zinc-500">„{request.message}”</p>}
          <p className="mt-1 text-xs text-zinc-400">{new Date(request.created_at).toLocaleString("ro-RO")}</p>
        </div>

        {!readonly && (
          <div className="flex shrink-0 gap-2">
            <Link href="/admin/clienti" className="mm-btn text-xs" data-variant="primary">
              Creează cont + confirmă
            </Link>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await markBookingRequestConfirmed(request.id);
                    toast.success("Cerere marcată rezolvată.");
                  } catch {
                    toast.error("Nu am reușit. Încearcă din nou.");
                  }
                })
              }
            >
              Marchează rezolvată
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await rejectBookingRequest(request.id);
                    toast.success("Cerere respinsă.");
                  } catch {
                    toast.error("Nu am reușit. Încearcă din nou.");
                  }
                })
              }
            >
              Respinge
            </Button>
          </div>
        )}
        {readonly && <Badge variant="neutral">{request.status}</Badge>}
      </div>
    </div>
  );
}
