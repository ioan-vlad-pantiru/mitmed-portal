"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPackagePaid, markPaymentPaid } from "@/actions/payments";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Target = { paymentId: string } | { packagePurchaseId: string };

/** Buton "Încasează" care se deschide într-un mic formular de sumă — implicit
 * restul întreg (achitare completă dintr-un click), dar suma se poate edita
 * pentru o încasare parțială. Reutilizat oriunde apare o plată neîncasată/
 * parțial încasată (Plăți client — terapii individuale și pachete, Sume
 * neîncasate din insights). Pentru un pachet (`packagePurchaseId`), suma se
 * împarte automat pe restul fiecărei terapii incluse — vezi
 * routers/payments.py:mark_package_paid. */
export function MarkPaidControl({
  target,
  clientId,
  remaining,
  onPaid,
}: {
  target: Target;
  clientId: string;
  remaining: number;
  /** Apelat suplimentar după o încasare reușită — util când componenta
   * părinte ține propria listă locală (ex. dialogul de sume neîncasate),
   * care nu se actualizează doar prin router.refresh(). */
  onPaid?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => remaining.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit() {
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Introdu o sumă validă.");
      return;
    }
    startTransition(async () => {
      const result =
        "paymentId" in target
          ? await markPaymentPaid(target.paymentId, clientId, value)
          : await markPackagePaid(target.packagePurchaseId, clientId, value);
      if (result.ok) {
        toast.success(value >= remaining ? "Plată încasată integral." : "Încasare parțială înregistrată.");
        setOpen(false);
        router.refresh();
        onPaid?.();
      } else {
        setError(result.message);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="success" className="text-xs" onClick={() => setOpen(true)}>
        Încasează
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Input
        type="number"
        min={0.01}
        max={remaining}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 py-1 text-xs"
        autoFocus
      />
      <Button type="button" variant="success" className="text-xs" disabled={pending} onClick={submit}>
        {pending ? "…" : "Confirmă"}
      </Button>
      <Button type="button" variant="ghost" className="text-xs" disabled={pending} onClick={() => setOpen(false)}>
        Anulează
      </Button>
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
