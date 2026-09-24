"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePackagePurchase, deletePayment } from "@/actions/payments";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

type Target = { paymentId: string } | { packagePurchaseId: string };

/** Ștergere definitivă a unei plăți introduse greșit — doar pentru ADMIN
 * (backend-ul aplică regula; UI-ul o ascunde pentru restul). Cere confirmare
 * în linie, fiindcă nu se poate anula. Diferă de "Corectează încasarea", care
 * doar schimbă suma încasată și lasă linia în istoric. */
export function DeletePaymentControl({ target, clientId, label }: { target: Target; clientId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result =
        "paymentId" in target
          ? await deletePayment(target.paymentId, clientId)
          : await deletePackagePurchase(target.packagePurchaseId, clientId);
      if (result.ok) {
        toast.success("Plata a fost ștearsă.");
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline"
      >
        Șterge plata
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-xs text-zinc-600">Ștergi definitiv „{label}”?</span>
      <Button type="button" variant="danger" className="text-xs" disabled={pending} onClick={submit}>
        {pending ? "…" : "Da, șterge"}
      </Button>
      <Button type="button" variant="ghost" className="text-xs" disabled={pending} onClick={() => setConfirming(false)}>
        Nu
      </Button>
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
