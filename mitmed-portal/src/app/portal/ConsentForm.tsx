"use client";

import { useActionState, useState } from "react";
import { signConsent } from "@/actions/consents";
import { SignaturePad } from "@/components/SignaturePad";

export function ConsentForm({ consentText }: { consentText: string }) {
  const [state, action, pending] = useActionState(signConsent, undefined);
  const [signature, setSignature] = useState<string | null>(null);

  if (state?.success) {
    return (
      <div className="mm-card p-4 text-sm text-emerald-700">Acordul a fost semnat. Mulțumim!</div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 mm-card p-4">
      <p className="whitespace-pre-wrap text-sm text-zinc-600">{consentText}</p>
      <input type="hidden" name="signature" value={signature ?? ""} />
      <div>
        <label className="block text-xs font-medium text-zinc-700">Semnătura ta</label>
        <div className="mt-1 max-w-sm">
          <SignaturePad onChange={setSignature} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending || !signature}
        className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "Se trimite…" : "Semnează și trimite"}
      </button>
    </form>
  );
}
