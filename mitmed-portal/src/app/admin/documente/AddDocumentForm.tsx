"use client";

import { useActionState, useState } from "react";
import { createConsentTemplate } from "@/actions/consents";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Adaugă un tip nou de document de semnat — devine imediat vizibil
 * clienților în portal, fără nicio schimbare de cod. */
export function AddDocumentForm() {
  const [state, action, pending] = useActionState(createConsentTemplate, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Adaugă un document nou
      </Button>
    );
  }

  return (
    <form action={action} className="max-w-2xl space-y-3 mm-card p-4">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Nume document</label>
        <Input name="label" required className="mt-1" placeholder="ex. Acord vaccinare" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Text</label>
        <Textarea name="text" required rows={6} className="mt-1" placeholder="Textul pe care clientul îl va semna…" />
      </div>
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se adaugă…" : "Adaugă document"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Renunță
        </Button>
      </div>
    </form>
  );
}
