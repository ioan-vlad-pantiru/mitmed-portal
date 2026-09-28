"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSheetField, updateSheetField, type ConsultationSheetField } from "@/actions/consultationSheets";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";

/** Formularul unui câmp din fișă — adăugare (fără `field`) sau editare. */
export function SheetFieldForm({ field, onDone }: { field?: ConsultationSheetField; onDone?: () => void }) {
  const save = field ? updateSheetField.bind(null, field.id) : createSheetField;
  const [state, action, pending] = useActionState(save, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!state?.success) return;
    toast.success(state.message ?? "Salvat.");
    if (!field) formRef.current?.reset();
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const idPrefix = field ? `f-${field.id}` : "f-new";
  return (
    <form ref={formRef} action={action} className="mt-2 grid max-w-2xl gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-label`} className="block text-xs font-medium text-zinc-700">Denumire</label>
        <Input id={`${idPrefix}-label`} name="label" required maxLength={120} defaultValue={field?.label ?? ""} placeholder="ex: Alergii" className="mt-1" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-type`} className="block text-xs font-medium text-zinc-700">Tip</label>
        <Select id={`${idPrefix}-type`} name="fieldType" defaultValue={field?.field_type ?? "textarea"} className="mt-1">
          <option value="textarea">Text lung (mai multe rânduri)</option>
          <option value="text">Text scurt (un rând, ex: puls)</option>
        </Select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-section`} className="block text-xs font-medium text-zinc-700">Secțiune (opțional)</label>
        <Input id={`${idPrefix}-section`} name="section" maxLength={120} defaultValue={field?.section ?? ""} placeholder="ex: Consultații / Investigații / Evaluări" className="mt-1" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-placeholder`} className="block text-xs font-medium text-zinc-700">Indiciu în câmp (opțional)</label>
        <Input id={`${idPrefix}-placeholder`} name="placeholder" maxLength={120} defaultValue={field?.placeholder ?? ""} placeholder="ex: mg/dl" className="mt-1" />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
        <input type="checkbox" name="carryOver" defaultChecked={field?.carry_over ?? false} />
        Precompletează pe o fișă nouă din ultima fișă a pacientului (ex: antecedente)
      </label>
      {state?.message && !state.success && <p className="text-sm text-red-600 sm:col-span-2">{state.message}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : field ? "Salvează modificările" : "Adaugă câmpul"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Anulează
          </Button>
        )}
      </div>
    </form>
  );
}
