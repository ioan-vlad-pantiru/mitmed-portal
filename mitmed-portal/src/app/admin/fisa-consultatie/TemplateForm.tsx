"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSheetTemplate,
  deleteSheetTemplate,
  updateSheetTemplate,
  type SheetTemplate,
} from "@/actions/consultationSheets";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";

/** Denumirea, descrierea și vizibilitatea unui tip de fișă — creare (fără
 * `template`) sau editare. */
export function TemplateForm({ template }: { template?: SheetTemplate }) {
  const save = template ? updateSheetTemplate.bind(null, template.id) : createSheetTemplate;
  const [state, action, pending] = useActionState(save, undefined);
  const [deleting, startDelete] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!state?.success) return;
    toast.success(state.message ?? "Salvat.");
    if (state.id) router.push(`/admin/fisa-consultatie?t=${state.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const prefix = template ? `t-${template.id}` : "t-new";
  return (
    <form action={action} className="mm-card grid max-w-2xl gap-3 p-4 sm:grid-cols-2">
      <div>
        <label htmlFor={`${prefix}-name`} className="block text-xs font-medium text-zinc-700">Denumirea fișei</label>
        <Input id={`${prefix}-name`} name="name" required maxLength={120} defaultValue={template?.name ?? ""} placeholder="ex: Fișă de evaluare posturală" className="mt-1" />
      </div>
      <div>
        <label htmlFor={`${prefix}-description`} className="block text-xs font-medium text-zinc-700">Descriere (opțional)</label>
        <Input id={`${prefix}-description`} name="description" maxLength={300} defaultValue={template?.description ?? ""} placeholder="Când se completează" className="mt-1" />
      </div>
      {template?.kind !== "tratament" && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
          <input type="checkbox" name="visibleToClient" defaultChecked={template?.visible_to_client ?? true} />
          Pacientul vede fișa în contul lui și o poate descărca în PDF
        </label>
      )}
      {template?.kind === "tratament" && <input type="hidden" name="visibleToClient" value="" />}
      {state?.message && !state.success && <p className="text-sm text-red-600 sm:col-span-2">{state.message}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : template ? "Salvează" : "Creează fișa"}
        </Button>
        {template?.kind === "custom" && (
          <Button
            type="button"
            variant="danger"
            disabled={deleting}
            onClick={() => {
              if (!window.confirm(`Ștergi fișa „${template.name}”? Fișele deja completate rămân în dosarele pacienților, dar nu se mai pot crea altele noi.`)) return;
              startDelete(async () => {
                const result = await deleteSheetTemplate(template.id);
                if (result.ok) {
                  toast.success("Fișă ștearsă.");
                  router.push("/admin/fisa-consultatie");
                } else {
                  toast.error(result.message);
                }
              });
            }}
          >
            Șterge fișa
          </Button>
        )}
      </div>
    </form>
  );
}
