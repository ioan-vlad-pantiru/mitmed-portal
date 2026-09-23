"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveClient, suspendClient } from "@/actions/clients";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

export function PendingClientRow({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string | null;
  fullName: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveClient(userId);
        toast.success(`Cont aprobat pentru ${fullName}.`);
        router.refresh();
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
        router.refresh();
      } catch {
        toast.error("Nu am putut respinge contul. Încearcă din nou.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-md bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>
        <strong className="text-zinc-900">{fullName}</strong>{" "}
        <span className="break-all text-zinc-500">{email ?? "—"}</span>
      </span>
      <span className="flex gap-2">
        <Button variant="success" disabled={pending} onClick={handleApprove} className="flex-1 sm:flex-none">
          Aprobă
        </Button>
        <Button variant="secondary" disabled={pending} onClick={handleReject} className="flex-1 sm:flex-none">
          Respinge
        </Button>
      </span>
    </li>
  );
}
