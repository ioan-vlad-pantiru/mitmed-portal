"use client";

import { useState, useTransition } from "react";
import { createPayuCheckout } from "@/actions/payments";

/** Buton "Plătește acum" — inițiază o comandă PayU și redirecționează
 * browserul către pagina de plată găzduită. Nu marchează nimic ca plătit
 * local; asta se întâmplă doar după confirmarea PayU (vezi /webhooks/payu). */
export function PayOnlineButton({ paymentId, className }: { paymentId: string; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createPayuCheckout(paymentId);
      if ("message" in result) {
        setError(result.message);
        return;
      }
      window.location.href = result.redirectUrl;
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={pending} className={className}>
        {pending ? "Se pregătește plata…" : "Plătește acum"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
