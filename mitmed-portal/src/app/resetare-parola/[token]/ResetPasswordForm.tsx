"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/actions/auth";
import { AuthPasswordField } from "@/components/AuthPasswordField";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.success) {
    return (
      <div className="space-y-5">
        <p className="rounded-lg bg-[var(--mitmed-mist)] px-4 py-3 text-sm text-[var(--mitmed-ink)]">
          Parola a fost schimbată. Din motive de siguranță, ai fost deconectat de pe toate dispozitivele.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60 text-center"
        >
          Intră în cont
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <AuthPasswordField id="newPassword" name="newPassword" label="Parolă nouă" autoComplete="new-password" />
      <AuthPasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirmă parola nouă"
        autoComplete="new-password"
      />

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60"
      >
        {pending ? "Se salvează…" : "Salvează parola"}
      </button>
    </form>
  );
}
