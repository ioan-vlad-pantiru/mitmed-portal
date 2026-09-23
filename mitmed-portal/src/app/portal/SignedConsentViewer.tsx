"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

/** Recitirea unui document deja semnat — read-only, nu oferă nicio cale de
 * a-l resemna sau modifica din acest ecran (pentru asta există explicit
 * butonul de retragere, alături). Arată exact textul semnat la momentul
 * respectiv (version_text), nu textul curent al șablonului — cele două pot
 * diverge dacă admin a actualizat între timp documentul. */
export function SignedConsentViewer({
  label,
  text,
  signedAt,
  signatureDataUrl,
}: {
  label: string;
  text: string;
  signedAt: string;
  signatureDataUrl: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-[var(--mitmed-teal)] hover:underline"
      >
        Vezi documentul
      </button>

      <Dialog open={open} onOpenChange={setOpen} title={label} description={`Semnat pe ${new Date(signedAt).toLocaleDateString("ro-RO")}`} size="lg">
        <p className="whitespace-pre-wrap font-[family-name:var(--font-editorial)] text-[15px] leading-relaxed text-zinc-700">
          {text}
        </p>
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Semnătura ta</p>
          <div className="mt-2 max-w-sm rounded-lg border border-zinc-200 bg-zinc-50/60 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL locală, nu imagine optimizabilă */}
            <img src={signatureDataUrl} alt={`Semnătura ta pentru ${label}`} className="h-24 w-full object-contain" />
          </div>
        </div>
      </Dialog>
    </>
  );
}
