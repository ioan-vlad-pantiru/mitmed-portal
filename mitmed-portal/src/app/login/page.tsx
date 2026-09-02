"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <AuthShell
      heading="Autentificare"
      subheading="Portal intern — clienți și personal."
      footer={
        <>
          Client nou?{" "}
          <Link href="/inregistrare" className="font-medium text-[var(--mitmed-teal)] hover:underline">
            Creează-ți un cont
          </Link>
        </>
      }
    >
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
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Parolă
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60"
        >
          {pending ? "Se autentifică…" : "Intră în cont"}
        </button>
      </form>
    </AuthShell>
  );
}
