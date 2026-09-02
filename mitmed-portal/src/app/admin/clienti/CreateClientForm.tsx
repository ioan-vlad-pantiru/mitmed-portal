"use client";

import { useActionState, useEffect, useState } from "react";
import { createClientAccount } from "@/actions/clients";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CreateClientForm() {
  const [state, action, pending] = useActionState(createClientAccount, undefined);

  // Câmpuri controlate — ca datele introduse să nu dispară dacă submisia
  // eșuează (ex: parolă prea scurtă). Parola nu e niciodată restaurată.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state?.values) {
      setFullName(state.values.fullName ?? "");
      setEmail(state.values.email ?? "");
      setPhone(state.values.phone ?? "");
    }
    if (state?.success) {
      setFullName("");
      setEmail("");
      setPhone("");
      // Forțează remount doar la succes, ca să golească și câmpul de
      // parolă (necontrolat) — la eroare formularul NU se remontează.
      setResetKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form
      key={resetKey}
      action={action}
      autoComplete="off"
      className="mt-3 grid max-w-2xl grid-cols-2 gap-3 mm-card p-4"
    >
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Nume complet</label>
        <Input
          name="fullName"
          required
          autoComplete="off"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Email</label>
        <Input
          name="email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Telefon</label>
        <Input
          name="phone"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-700">Parolă inițială</label>
        <Input name="password" type="password" required autoComplete="new-password" className="mt-1" />
      </div>

      {state?.message && (
        <p className={`col-span-2 text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}

      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se creează…" : "Creează cont"}
        </Button>
      </div>
    </form>
  );
}
