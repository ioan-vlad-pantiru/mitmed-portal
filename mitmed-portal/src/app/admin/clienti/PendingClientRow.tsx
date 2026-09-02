"use client";

import { useTransition } from "react";
import { approveClient, suspendClient } from "@/actions/clients";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

export function PendingClientRow({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveClient(userId);
        toast.success(`Cont aprobat pentru ${fullName}.`);
      } catch {
        toast.error("Nu am putut aproba contul. Încearcă din nou.");
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await suspendClient(userId);
        toast.success(`Cont respins pentru ${fullName}.`);
      } catch {
        toast.error("Nu am putut respinge contul. Încearcă din nou.");
      }
    });
  }

  return (
    <li className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
      <span>
        <strong className="text-zinc-900">{fullName}</strong>{" "}
        <span className="text-zinc-500">{email}</span>
      </span>
      <span className="flex gap-2">
        <Button variant="success" disabled={pending} onClick={handleApprove}>
          Aprobă
        </Button>
        <Button variant="secondary" disabled={pending} onClick={handleReject}>
          Respinge
        </Button>
      </span>
    </li>
  );
}
