"use client";

import { useActionState, useMemo, useState } from "react";
import { signConsent, type ConsentType } from "@/actions/consents";
import { SignaturePad } from "@/components/SignaturePad";
import { Dialog } from "@/components/ui/Dialog";

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
  // Semnătura se desenează într-un modal mare (mai ușor pe telefon); abia la
  // "Confirmă" trece din ciornă în formular.
  const [signing, setSigning] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  function openSigning() {
    setDraft(null);
    setSigning(true);
  }

  function confirmSignature() {
    setSignature(draft);
    setSigning(false);
  }
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
            MitMed <span className="font-normal text-zinc-400">· Cabinet Individual de Fizioterapie Mitu Sebastian-Mihai</span>
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
          <button
            type="button"
            onClick={openSigning}
            className="group mt-2 flex h-32 w-full max-w-sm items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white transition-colors hover:border-[var(--mitmed-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mitmed-sky)]"
            aria-label={signature ? "Modifică semnătura" : "Semnează documentul"}
          >
            {signature ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL locală, nu imagine optimizabilă
              <img src={signature} alt="Semnătura ta" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-sm font-medium text-[var(--mitmed-teal)] group-hover:underline">
                Apasă aici pentru a semna ✍️
              </span>
            )}
          </button>
          {signature && (
            <button
              type="button"
              onClick={openSigning}
              className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 hover:underline"
            >
              Modifică semnătura
            </button>
          )}
          <div className="mt-2 flex max-w-sm justify-between text-xs text-zinc-400">
            <span>{clientName}</span>
            <span>{today}</span>
          </div>
        </div>

        {state?.message && <p className="px-6 pb-2 text-sm text-red-600 sm:px-8">{state.message}</p>}

        <Dialog
          open={signing}
          onOpenChange={setSigning}
          title="Semnătura ta"
          description="Semnează cu degetul sau cu mouse-ul în spațiul de mai jos."
          size="lg"
        >
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
            <SignaturePad onChange={setDraft} width={900} height={320} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-400">
            <span>{clientName}</span>
            <span>{today}</span>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSigning(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={confirmSignature}
              disabled={!draft}
              className="rounded-md bg-[var(--mitmed-teal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-50"
            >
              Confirmă semnătura
            </button>
          </div>
        </Dialog>

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
