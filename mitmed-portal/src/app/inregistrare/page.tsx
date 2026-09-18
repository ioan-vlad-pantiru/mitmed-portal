"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerClient } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerClient, undefined);

  if (state?.success) {
    return (
      <AuthShell heading="Cont creat" subheading="Un ultim pas — recepția trebuie să-l aprobe.">
        <p className="text-sm text-zinc-600">{state.message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-[var(--mitmed-teal)] hover:underline"
        >
          Înapoi la autentificare
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Creează cont client"
      subheading="Contul devine activ după aprobarea recepției."
      footer={
        <>
          Ai deja cont?{" "}
          <Link href="/login" className="font-medium text-[var(--mitmed-teal)] hover:underline">
            Autentifică-te
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
            Nume complet
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

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
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
            Telefon (opțional)
          </label>
          <input
            id="phone"
            name="phone"
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
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-zinc-700">
            Data nașterii
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Auto-înregistrarea este posibilă de la 16 ani. Pentru un minor, contul se creează la recepție, cu acordul
            unui părinte/tutore.
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="acceptedPrivacyPolicy"
            name="acceptedPrivacyPolicy"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[var(--mitmed-teal)] focus:ring-[var(--mitmed-sky)]/40"
          />
          <label htmlFor="acceptedPrivacyPolicy" className="text-sm text-zinc-600">
            Am citit și sunt de acord cu{" "}
            <Link href="/confidentialitate" target="_blank" className="font-medium text-[var(--mitmed-teal)] hover:underline">
              Politica de confidențialitate
            </Link>{" "}
            și{" "}
            <Link href="/termeni" target="_blank" className="font-medium text-[var(--mitmed-teal)] hover:underline">
              Termenii și condițiile
            </Link>
            .
          </label>
        </div>

        {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60"
        >
          {pending ? "Se creează…" : "Creează cont"}
        </button>
      </form>
    </AuthShell>
  );
}
