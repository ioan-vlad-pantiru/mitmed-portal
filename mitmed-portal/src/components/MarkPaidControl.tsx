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
 * pentru o încasare parțială. Un link suplimentar comută pe împărțire
 * numerar/card, când clientul plătește diferența în două metode deodată.
 * Reutilizat oriunde apare o plată neîncasată/parțial încasată (Plăți client
 * — terapii individuale și pachete, Sume neîncasate din insights). Pentru un
 * pachet (`packagePurchaseId`), suma se împarte automat pe restul fiecărei
 * terapii incluse — vezi routers/payments.py:mark_package_paid. */
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
  const [split, setSplit] = useState(false);
  const [amount, setAmount] = useState(() => remaining.toFixed(2));
  const [cashAmount, setCashAmount] = useState(() => remaining.toFixed(2));
  const [cardAmount, setCardAmount] = useState("0.00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit() {
    setError(null);

    if (split) {
      const cash = Number(cashAmount) || 0;
      const card = Number(cardAmount) || 0;
      const total = cash + card;
      if (cash < 0 || card < 0 || total <= 0) {
        setError("Introdu cel puțin o sumă validă pe numerar sau card.");
        return;
      }
      if (total > remaining + 0.01) {
        setError("Suma totală depășește restul de plată.");
        return;
      }
      startTransition(async () => {
        const result =
          "paymentId" in target
            ? await markPaymentPaid(target.paymentId, clientId, { cashAmount: cash, cardAmount: card })
            : await markPackagePaid(target.packagePurchaseId, clientId, { cashAmount: cash, cardAmount: card });
        if (result.ok) {
          toast.success(total >= remaining ? "Plată încasată integral (numerar + card)." : "Încasare parțială mixtă înregistrată.");
          setOpen(false);
          router.refresh();
          onPaid?.();
        } else {
          setError(result.message);
        }
      });
      return;
    }

    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Introdu o sumă validă.");
      return;
    }
    startTransition(async () => {
      const result =
        "paymentId" in target
          ? await markPaymentPaid(target.paymentId, clientId, { amount: value })
          : await markPackagePaid(target.packagePurchaseId, clientId, { amount: value });
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
    <div className="flex flex-wrap items-end justify-end gap-1.5">
      {split ? (
        <>
          <label className="flex flex-col text-[10px] text-neutral-500">
            Numerar
            <Input
              type="number"
              min={0}
              max={remaining}
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="w-20 py-1 text-xs"
              autoFocus
            />
          </label>
          <label className="flex flex-col text-[10px] text-neutral-500">
            Card
            <Input
              type="number"
              min={0}
              max={remaining}
              step="0.01"
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
              className="w-20 py-1 text-xs"
            />
          </label>
        </>
      ) : (
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
      )}
      <Button type="button" variant="success" className="text-xs" disabled={pending} onClick={submit}>
        {pending ? "…" : "Confirmă"}
      </Button>
      <Button type="button" variant="ghost" className="text-xs" disabled={pending} onClick={() => setOpen(false)}>
        Anulează
      </Button>
      <button
        type="button"
        className="w-full text-right text-[11px] text-teal-700 underline underline-offset-2 hover:text-teal-900"
        disabled={pending}
        onClick={() => setSplit((s) => !s)}
      >
        {split ? "Sumă unică" : "Împarte numerar / card"}
      </button>
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
