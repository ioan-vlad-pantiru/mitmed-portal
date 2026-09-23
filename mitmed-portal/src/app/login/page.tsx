"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { AuthPasswordField } from "@/components/AuthPasswordField";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  // Controlate — ca datele introduse (inclusiv parola, aici, spre deosebire
  // de /inregistrare) să nu dispară dacă autentificarea eșuează. La o
  // parolă greșită, retastarea și emailul/telefonul ar fi frustrantă.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell
      heading="Bine ai revenit."
      subheading="Autentifică-te pentru programări, plăți și fișa ta medicală."
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
          <label htmlFor="identifier" className="block text-sm font-medium text-zinc-700">
            Email sau telefon
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
          />
        </div>

        <AuthPasswordField
          id="password"
          name="password"
          label="Parolă"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

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
