"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <AuthShell
      heading="Ai uitat parola?"
      subheading="Îți trimitem pe email un link cu care îți alegi o parolă nouă."
      footer={
        <>
          Ți-ai amintit-o?{" "}
          <Link href="/login" className="font-medium text-[var(--mitmed-teal)] hover:underline">
            Înapoi la autentificare
          </Link>
        </>
      }
    >
      {state?.success ? (
        <p className="rounded-lg bg-[var(--mitmed-mist)] px-4 py-3 text-sm text-[var(--mitmed-ink)]">{state.message}</p>
      ) : (
        <form action={action} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Contul tău nu are email (te autentifici cu telefonul)? Sună la recepție și îți resetăm parola noi.
            </p>
          </div>

          {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60"
          >
            {pending ? "Se trimite…" : "Trimite link-ul de resetare"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
