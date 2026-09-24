"use client";

import { useActionState } from "react";
import { updateClientDetails } from "@/actions/clients";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type PatientDetails = {
  full_name: string;
  phone: string | null;
  cnp: string | null;
  birth_date: string | null;
  profile_data: { gender?: string; city?: string; county?: string; address?: string; occupation?: string } | null;
};

function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Datele pacientului pentru fișa medicală. Personalul le poate completa sau
 * corecta când pacientul nu a avut timp să le introducă din portal. */
export function PatientDetailsForm({ clientId, client }: { clientId: string; client: PatientDetails }) {
  const [state, action, pending] = useActionState(updateClientDetails.bind(null, clientId), undefined);
  const profile = client.profile_data ?? {};

  return (
    <form action={action} className="mt-3 mm-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Datele pacientului</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Completează sau corectează datele dacă pacientul nu le-a introdus din contul lui. Apar și pe fișa de consultație.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nume și prenume" htmlFor="fullName" className="sm:col-span-2 lg:col-span-1">
          <Input id="fullName" name="fullName" defaultValue={client.full_name} required />
        </Field>
        <Field label="CNP" htmlFor="cnp">
          <Input id="cnp" name="cnp" defaultValue={client.cnp ?? ""} inputMode="numeric" pattern="\d{13}" maxLength={13} autoComplete="off" placeholder="13 cifre" className="tabular-nums" />
        </Field>
        <Field label="Data nașterii" htmlFor="birthDate">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={client.birth_date?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Sex" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={profile.gender ?? ""}>
            <option value="">—</option>
            <option value="FEMININ">Feminin</option>
            <option value="MASCULIN">Masculin</option>
            <option value="NU_DORESC_SA_SPUN">Nu doresc să spun</option>
          </Select>
        </Field>
        <Field label="Telefon" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={client.phone ?? ""} />
        </Field>
        <Field label="Ocupația" htmlFor="occupation">
          <Input id="occupation" name="occupation" defaultValue={profile.occupation ?? ""} />
        </Field>
        <Field label="Localitate" htmlFor="city">
          <Input id="city" name="city" defaultValue={profile.city ?? ""} />
        </Field>
        <Field label="Județ" htmlFor="county">
          <Input id="county" name="county" defaultValue={profile.county ?? ""} />
        </Field>
        <Field label="Domiciliul (adresa)" htmlFor="address" className="sm:col-span-2 lg:col-span-3">
          <Input id="address" name="address" defaultValue={profile.address ?? ""} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salvează…" : "Salvează datele pacientului"}
        </Button>
        {state?.message && (
          <p className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}
