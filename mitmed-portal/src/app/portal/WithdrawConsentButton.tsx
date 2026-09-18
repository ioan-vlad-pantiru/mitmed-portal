"use client";

import { useState, useTransition } from "react";
import { withdrawConsent } from "@/actions/consents";
import { useToast } from "@/components/Toast";

export function WithdrawConsentButton({ consentId }: { consentId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Retragi acest consimțământ?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await withdrawConsent(consentId);
              if (!result.ok) {
                toast.error(result.message);
              } else {
                toast.success("Consimțământ retras.");
              }
              setConfirming(false);
            })
          }
          className="font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Da, retrage
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-zinc-400 underline-offset-2 hover:underline"
        >
          Renunță
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline"
    >
      Retrage
    </button>
  );
}
