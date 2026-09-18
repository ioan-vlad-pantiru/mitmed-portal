"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="mt-3 max-w-sm space-y-4 mm-card p-4">
      <label className="block text-xs font-medium text-zinc-700">
        Parola curentă
        <Input name="currentPassword" type="password" autoComplete="current-password" required className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-zinc-700">
        Parola nouă
        <Input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-700">
        Confirmă parola nouă
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1"
        />
      </label>

      {state?.message && <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Schimbă parola"}</Button>
    </form>
  );
}
