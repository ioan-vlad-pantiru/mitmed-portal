"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctAmountPaid, correctPackageAmountPaid } from "@/actions/payments";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Target = { paymentId: string } | { packagePurchaseId: string };

/** Undo pentru o încasare greșită la recepție — sumă greșită introdusă, sau
 * "Încasează" apăsat din greșeală pe plata/clientul nepotrivit. Spre
 * deosebire de MarkPaidControl (care ADAUGĂ), aici suma tastată ÎNLOCUIEȘTE
 * ce era încasat până acum — 0 anulează complet. Nu apare pentru o plată
 * confirmată prin PayU (vezi `paidViaPayu`) — acolo banii chiar au circulat,
 * o "corecție" locală n-ar face decât să ascundă o plată reală. */
export function CorrectPaymentControl({
  target,
  clientId,
  currentAmountPaid,
  onCorrected,
}: {
  target: Target;
  clientId: string;
  currentAmountPaid: number;
  /** Ca la MarkPaidControl — pentru un părinte cu listă locală proprie (ex.
   * dialogul de sume neîncasate), care nu se actualizează doar prin
   * router.refresh(). */
  onCorrected?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => currentAmountPaid.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit() {
    setError(null);
    const value = Number(amount);
    if (value < 0 || Number.isNaN(value)) {
      setError("Introdu o sumă validă.");
      return;
    }
    startTransition(async () => {
      const result =
        "paymentId" in target
          ? await correctAmountPaid(target.paymentId, clientId, value)
          : await correctPackageAmountPaid(target.packagePurchaseId, clientId, value);
      if (result.ok) {
        toast.success(value === 0 ? "Încasare anulată." : "Sumă încasată corectată.");
        setOpen(false);
        router.refresh();
        onCorrected?.();
      } else {
        setError(result.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline"
      >
        Corectează încasarea
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-xs text-zinc-500">Suma corectă:</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 py-1 text-xs"
        autoFocus
      />
      <Button type="button" variant="danger" className="text-xs" disabled={pending} onClick={submit}>
        {pending ? "…" : "Confirmă"}
      </Button>
      <Button type="button" variant="ghost" className="text-xs" disabled={pending} onClick={() => setOpen(false)}>
        Anulează
      </Button>
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => setAmount("0")}
        className="w-full text-right text-xs text-zinc-400 hover:text-red-600 hover:underline"
      >
        De fapt n-a fost plătită deloc
      </button>
    </div>
  );
}
