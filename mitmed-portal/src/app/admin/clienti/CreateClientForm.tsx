"use client";

import { useActionState, useState } from "react";
import { createClientAccount } from "@/actions/clients";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CreateClientForm() {
  const [state, action, pending] = useActionState(createClientAccount, undefined);

  // Câmpuri controlate — ca datele introduse să nu dispară dacă submisia
  // eșuează (ex: parolă prea scurtă). Nu mai e nevoie să le sincronizăm
  // înapoi din `state.values` la eroare: acțiunea doar ecouă ce a trimis
  // formularul, fără normalizare, iar input-urile controlate păstrează deja
  // ce a tastat userul — un efect care le rescrie cu aceeași valoare era
  // muncă degeaba (și interzisă de regula de puritate a randării).
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resetKey, setResetKey] = useState(0);

  // Golește formularul o singură dată, la tranziția reală spre succes — nu
  // într-un efect, ci comparând cu ultimul `state` deja procesat (pattern-ul
  // recomandat de React pentru "reacționează la o schimbare de rezultat" fără
  // efect). Remontarea (key nou) golește și câmpul de parolă, necontrolat.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setResetKey((k) => k + 1);
    }
  }

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
        <label className="block text-xs font-medium text-zinc-700">Email (opțional)</label>
        <Input
          name="email"
          type="email"
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
          required
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
