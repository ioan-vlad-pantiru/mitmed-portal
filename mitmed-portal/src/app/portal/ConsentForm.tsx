"use client";

import { useActionState, useMemo, useState } from "react";
import { signConsent, type ConsentType } from "@/actions/consents";
import { SignaturePad } from "@/components/SignaturePad";

export function ConsentForm({
  type,
  title,
  consentText,
  clientName,
}: {
  type: ConsentType;
  title: string;
  consentText: string;
  clientName: string;
}) {
  const boundSign = signConsent.bind(null, type);
  const [state, action, pending] = useActionState(boundSign, undefined);
  const [signature, setSignature] = useState<string | null>(null);
  const today = useMemo(() => new Date().toLocaleDateString("ro-RO"), []);

  if (state?.success) {
    return (
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-emerald-50 px-6 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            ✓
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">{title}</p>
            <p className="text-xs text-emerald-700">Semnat pe {today}. Mulțumim!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,24,0.04),0_12px_32px_-16px_rgba(0,63,64,0.2)]">
      {/* Antet — ca pe un document tipărit */}
      <div className="border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-[var(--mitmed-teal)]">
            MitMed <span className="font-normal text-zinc-400">· Semarvion SRL</span>
          </span>
          <span className="text-xs text-zinc-400">{today}</span>
        </div>
        <h2 className="mt-3 font-[family-name:var(--font-editorial)] text-xl italic text-zinc-900">{title}</h2>
      </div>

      <form action={action}>
        <div className="px-6 py-6 sm:px-8">
          <p className="whitespace-pre-wrap font-[family-name:var(--font-editorial)] text-[15px] leading-relaxed text-zinc-700">
            {consentText}
          </p>
        </div>

        <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-6 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Semnătura</p>
          <input type="hidden" name="signature" value={signature ?? ""} />
          <div className="mt-2 max-w-sm">
            <SignaturePad onChange={setSignature} />
          </div>
          <div className="mt-2 flex max-w-sm justify-between text-xs text-zinc-400">
            <span>{clientName}</span>
            <span>{today}</span>
          </div>
        </div>

        {state?.message && <p className="px-6 pb-2 text-sm text-red-600 sm:px-8">{state.message}</p>}

        <div className="border-t border-zinc-100 px-6 py-4 sm:px-8">
          <button
            type="submit"
            disabled={pending || !signature}
            className="rounded-md bg-[var(--mitmed-teal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-50"
          >
            {pending ? "Se trimite…" : "Semnează și trimite"}
          </button>
        </div>
      </form>
    </div>
  );
}
