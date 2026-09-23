"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { registerClient } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { AuthPasswordField } from "@/components/AuthPasswordField";
import { VerifyCodeForm } from "./VerifyCodeForm";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerClient, undefined);

  // Câmpuri controlate — ca datele introduse să nu dispară dacă submisia
  // eșuează (ex: telefon deja folosit). Parola rămâne necontrolată/nu se
  // păstrează, ca în restul aplicației (vezi CreateClientForm.tsx).
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);

  if (state?.success && state.phone) {
    return (
      <AuthShell heading="Încă un pas." subheading="Confirmă numărul de telefon și ești în cont.">
        <VerifyCodeForm phone={state.phone} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Ai ajuns unde trebuie."
      subheading="Mai sunt doar câțiva pași până la prima ta programare."
      footer={
        <>
          Ai deja cont?{" "}
          <Link href="/login" className="font-medium text-[var(--mitmed-teal)] hover:underline">
            Autentifică-te
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-[var(--mitmed-sky)]/12 px-3.5 py-3 text-sm text-[var(--mitmed-teal-deep)]">
        <CalendarCheck2 size={18} className="mt-0.5 shrink-0" />
        <p>
          Completezi datele o singură dată (sub 2 minute), confirmi telefonul printr-un cod SMS, iar apoi alegi
          singur/ă ziua și ora ședinței, din calendar. Fără email — telefonul e suficient.
        </p>
      </div>
      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
            Nume complet
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email (opțional)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        <AuthPasswordField id="password" name="password" label="Parolă" autoComplete="new-password" />

        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-zinc-700">
            Data nașterii
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
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
            checked={acceptedPrivacyPolicy}
            onChange={(e) => setAcceptedPrivacyPolicy(e.target.checked)}
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
