"use client";

import { useActionState } from "react";
import { createStaff } from "@/actions/staff";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Role } from "@/lib/enums";

export function StaffForm() {
  const [state, action, pending] = useActionState(createStaff, undefined);

  return (
    <form action={action} className="mt-3 grid max-w-3xl grid-cols-2 gap-3 mm-card p-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Email</label>
        <Input name="email" type="email" required autoComplete="off" className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Rol</label>
        <Select name="role" defaultValue={Role.RECEPTIE} className="mt-1">
          <option value={Role.RECEPTIE}>Recepție</option>
          <option value={Role.ADMIN}>Admin (acces complet)</option>
        </Select>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Parolă inițială</label>
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Confirmă parola</label>
        <Input name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className="mt-1" />
      </div>
      <p className="col-span-2 text-xs text-zinc-500">
        Minimum 8 caractere. Comunică parola persoanei și roag-o să o schimbe din „Contul meu” la prima autentificare.
      </p>

      {state?.message && <p className="col-span-2 text-sm text-red-600">{state.message}</p>}
      {state?.created && (
        <p className="col-span-2 text-sm text-emerald-700">Cont creat pentru {state.created}. Se poate autentifica acum.</p>
      )}

      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se creează…" : "Creează cont"}
        </Button>
      </div>
    </form>
  );
}
