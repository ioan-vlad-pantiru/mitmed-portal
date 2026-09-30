"use client";

import { useActionState, useState, type ReactNode } from "react";
import { updateClientFullProfile, type ClientProfileEditState } from "@/actions/clients";
import type { ClientProfileData } from "@/app/portal/ProfileForm";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type EditableClient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cnp: string | null;
  birth_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_history: {
    allergies?: string;
    conditions?: string;
    medications?: string;
    previous_injuries?: string;
    notes?: string;
  } | null;
  profile_data: ClientProfileData;
};

/** Cardul de profil din admin: afișează `children` (vizualizarea) sau, în
 * modul de editare, un formular cu toate câmpurile de pe card. */
export function EditableProfileCard({
  client,
  header,
  actions,
  children,
}: {
  client: EditableClient;
  header: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: ClientProfileEditState, formData: FormData) => {
      const result = await updateClientFullProfile(client.id, prev, formData);
      if (result?.success) setEditing(false);
      return result;
    },
    undefined
  );
  const medical = client.medical_history ?? {};
  const profile = client.profile_data ?? {};

  return (
    <section className="mm-card p-4">
      <div className="flex items-start justify-between gap-3">
        {header}
        <div className="flex shrink-0 items-center gap-4">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-sky-600 hover:underline">
              Editează
            </button>
          )}
          {actions}
        </div>
      </div>

      {!editing && state?.success && <p className="mt-2 text-sm text-emerald-700">{state.message}</p>}

      {!editing ? (
        children
      ) : (
        <form action={action} className="mt-3 space-y-5">
          <Section title="Date de contact">
            <Field label="Nume și prenume" className="sm:col-span-2">
              <Input name="fullName" defaultValue={client.full_name} required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={client.email ?? ""} />
            </Field>
            <Field label="Telefon">
              <Input name="phone" type="tel" defaultValue={client.phone ?? ""} />
            </Field>
            <Field label="CNP">
              <Input name="cnp" defaultValue={client.cnp ?? ""} inputMode="numeric" pattern="\d{13}" maxLength={13} autoComplete="off" placeholder="13 cifre" className="tabular-nums" />
            </Field>
            <Field label="Data nașterii">
              <Input name="birthDate" type="date" defaultValue={client.birth_date?.slice(0, 10) ?? ""} />
            </Field>
            <Field label="Contact urgență — nume">
              <Input name="emergencyContactName" defaultValue={client.emergency_contact_name ?? ""} />
            </Field>
            <Field label="Contact urgență — telefon">
              <Input name="emergencyContactPhone" type="tel" defaultValue={client.emergency_contact_phone ?? ""} />
            </Field>
          </Section>

          <Section title="Chestionar medical">
            <Field label="Alergii" className="sm:col-span-2">
              <Textarea name="allergies" rows={2} defaultValue={medical.allergies ?? ""} />
            </Field>
            <Field label="Afecțiuni" className="sm:col-span-2">
              <Textarea name="conditions" rows={2} defaultValue={medical.conditions ?? ""} />
            </Field>
            <Field label="Medicamente" className="sm:col-span-2">
              <Textarea name="medications" rows={2} defaultValue={medical.medications ?? ""} />
            </Field>
            <Field label="Leziuni anterioare" className="sm:col-span-2">
              <Textarea name="previousInjuries" rows={2} defaultValue={medical.previous_injuries ?? ""} />
            </Field>
            <Field label="Alte note" className="sm:col-span-2 lg:col-span-4">
              <Textarea name="medicalNotes" rows={2} defaultValue={medical.notes ?? ""} />
            </Field>
          </Section>

          <Section title="Profil și preferințe">
            <Field label="Gen">
              <Select name="gender" defaultValue={profile.gender ?? ""}>
                <option value="">—</option>
                <option value="FEMININ">Feminin</option>
                <option value="MASCULIN">Masculin</option>
                <option value="NU_DORESC_SA_SPUN">Nu doresc să spun</option>
              </Select>
            </Field>
            <Field label="Localitate">
              <Input name="city" defaultValue={profile.city ?? ""} />
            </Field>
            <Field label="Județ">
              <Input name="county" defaultValue={profile.county ?? ""} />
            </Field>
            <Field label="Adresă">
              <Input name="address" defaultValue={profile.address ?? ""} />
            </Field>
            <Field label="Ocupație">
              <Input name="occupation" defaultValue={profile.occupation ?? ""} />
            </Field>
            <Field label="Categorie ocupație">
              <Select name="occupationCategory" defaultValue={profile.occupation_category ?? ""}>
                <option value="">—</option>
                <option value="SEDENTAR">Preponderent sedentară</option>
                <option value="ACTIV">Activă</option>
                <option value="MUNCA_FIZICA">Muncă fizică</option>
                <option value="PENSIONAR">Pensionar</option>
                <option value="ELEV_STUDENT">Elev / student</option>
                <option value="ALTELE">Altele</option>
              </Select>
            </Field>
            <Field label="Contact preferat">
              <Select name="preferredContact" defaultValue={profile.preferred_contact ?? ""}>
                <option value="">—</option>
                <option value="TELEFON">Telefon</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </Select>
            </Field>
            <Field label="Limbă preferată">
              <Select name="preferredLanguage" defaultValue={profile.preferred_language ?? ""}>
                <option value="">—</option>
                <option value="ROMANA">Română</option>
                <option value="ENGLEZA">Engleză</option>
              </Select>
            </Field>
            <Field label="Sursă">
              <Select name="referralSource" defaultValue={profile.referral_source ?? ""}>
                <option value="">—</option>
                <option value="RECOMANDARE">Recomandare</option>
                <option value="GOOGLE">Google</option>
                <option value="FACEBOOK_INSTAGRAM">Facebook / Instagram</option>
                <option value="SITE">Site</option>
                <option value="MEDIC">Medic</option>
                <option value="EVENIMENT">Eveniment</option>
                <option value="ALTELE">Altele</option>
              </Select>
            </Field>
            <Field label="Detalii sursă">
              <Input name="referralDetails" defaultValue={profile.referral_details ?? ""} maxLength={150} />
            </Field>
            <Field label="Activitate">
              <Select name="activityLevel" defaultValue={profile.activity_level ?? ""}>
                <option value="">—</option>
                <option value="SCĂZUT">Scăzut</option>
                <option value="MODERAT">Moderat</option>
                <option value="RIDICAT">Ridicat</option>
              </Select>
            </Field>
            <Field label="Obiectiv">
              <Select name="primaryGoal" defaultValue={profile.primary_goal ?? ""}>
                <option value="">—</option>
                <option value="DURERE">Reducerea durerii</option>
                <option value="MOBILITATE">Mobilitate</option>
                <option value="RECUPERARE">Recuperare</option>
                <option value="PREVENȚIE">Prevenție</option>
                <option value="PERFORMANȚĂ">Performanță</option>
                <option value="STARE_DE_BINE">Stare de bine</option>
                <option value="ALTELE">Altele</option>
              </Select>
            </Field>
            <Field label="Obiectiv secundar">
              <Input name="secondaryGoal" defaultValue={profile.secondary_goal ?? ""} maxLength={150} />
            </Field>
            <Field label="Interes">
              <Select name="interest" defaultValue={profile.interest ?? ""}>
                <option value="">—</option>
                <option value="REDUCERE_DURERE">Reducere durere</option>
                <option value="RECUPERARE_POSTOPERATORIE">Recuperare post-operatorie</option>
                <option value="TERAPIE_SPORTIVA">Terapie sportivă</option>
                <option value="WELLNESS_RELAXARE">Wellness / relaxare</option>
                <option value="PREVENTIE">Prevenție</option>
                <option value="ALTELE">Altele</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-600 sm:col-span-2 lg:col-span-4">
              <input name="communicationConsent" type="checkbox" defaultChecked={profile.communication_consent ?? false} />
              Acceptă comunicare marketing
            </label>
          </Section>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Se salvează…" : "Salvează"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
              Renunță
            </Button>
            {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
          </div>
        </form>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-zinc-100 pt-3">
      <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-zinc-700 ${className}`}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
