"use client";

import { useActionState, type ReactNode } from "react";
import { updateOwnProfileData } from "@/actions/clients";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

export type ClientProfileData = {
  gender?: string;
  city?: string;
  county?: string;
  address?: string;
  occupation?: string;
  occupation_category?: string;
  preferred_contact?: string;
  preferred_language?: string;
  referral_source?: string;
  referral_details?: string;
  activity_level?: string;
  primary_goal?: string;
  secondary_goal?: string;
  interest?: string;
  communication_consent?: boolean;
} | null;

export function ProfileForm({ initial, birthDate }: { initial: ClientProfileData; birthDate: string | null }) {
  const [state, action, pending] = useActionState(updateOwnProfileData, undefined);

  return (
    <form action={action} className="mt-3 space-y-5 mm-card p-4">
      <p className="max-w-3xl text-xs leading-5 text-zinc-500">
        Toate câmpurile sunt opționale. Folosim răspunsurile doar pentru a adapta comunicarea și pentru statistici
        agregate; datele tale individuale nu apar în rapoarte.
      </p>

      <fieldset>
        <legend className="text-sm font-semibold text-zinc-800">Despre tine</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Data nașterii">
            <Input name="birthDate" type="date" defaultValue={birthDate ?? undefined} />
          </Field>
          <Field label="Gen">
            <Select name="gender" defaultValue={initial?.gender ?? ""}>
              <option value="">Prefer să nu completez</option>
              <option value="FEMININ">Feminin</option>
              <option value="MASCULIN">Masculin</option>
              <option value="NU_DORESC_SA_SPUN">Prefer să nu spun</option>
            </Select>
          </Field>
          <Field label="Nivel de activitate">
            <Select name="activityLevel" defaultValue={initial?.activity_level ?? ""}>
              <option value="">Alege opțional</option>
              <option value="SCĂZUT">Scăzut</option>
              <option value="MODERAT">Moderat</option>
              <option value="RIDICAT">Ridicat</option>
            </Select>
          </Field>
          <Field label="Ocupație">
            <Input name="occupation" defaultValue={initial?.occupation} placeholder="ex. contabil" />
          </Field>
          <Field label="Tip de activitate profesională">
            <Select name="occupationCategory" defaultValue={initial?.occupation_category ?? ""}>
              <option value="">Alege opțional</option>
              <option value="SEDENTAR">Preponderent sedentară</option>
              <option value="ACTIV">Activă</option>
              <option value="MUNCA_FIZICA">Muncă fizică</option>
              <option value="PENSIONAR">Pensionar</option>
              <option value="ELEV_STUDENT">Elev / student</option>
              <option value="ALTELE">Altele</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-zinc-800">Contact și localitate</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Oraș"><Input name="city" defaultValue={initial?.city} /></Field>
          <Field label="Județ"><Input name="county" defaultValue={initial?.county} /></Field>
          <Field label="Adresă"><Input name="address" defaultValue={initial?.address} /></Field>
          <Field label="Canal de contact preferat">
            <Select name="preferredContact" defaultValue={initial?.preferred_contact ?? ""}>
              <option value="">Alege opțional</option><option value="TELEFON">Telefon</option><option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option>
            </Select>
          </Field>
          <Field label="Limba preferată">
            <Select name="preferredLanguage" defaultValue={initial?.preferred_language ?? ""}>
              <option value="">Alege opțional</option><option value="ROMANA">Română</option><option value="ENGLEZA">Engleză</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-zinc-800">Cum ai ajuns la noi și ce urmărești</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cum ai aflat de noi">
            <Select name="referralSource" defaultValue={initial?.referral_source ?? ""}>
              <option value="">Alege opțional</option><option value="RECOMANDARE">Recomandare</option><option value="GOOGLE">Google</option>
              <option value="FACEBOOK_INSTAGRAM">Facebook / Instagram</option><option value="SITE">Site</option><option value="MEDIC">Medic</option>
              <option value="EVENIMENT">Eveniment</option><option value="ALTELE">Altele</option>
            </Select>
          </Field>
          <Field label="Detalii recomandare / sursă"><Input name="referralDetails" defaultValue={initial?.referral_details} /></Field>
          <Field label="Obiectiv principal">
            <Select name="primaryGoal" defaultValue={initial?.primary_goal ?? ""}>
              <option value="">Alege opțional</option><option value="DURERE">Reducerea durerii</option><option value="MOBILITATE">Mobilitate</option>
              <option value="RECUPERARE">Recuperare</option><option value="PREVENȚIE">Prevenție</option><option value="PERFORMANȚĂ">Performanță</option>
              <option value="STARE_DE_BINE">Stare de bine</option><option value="ALTELE">Altele</option>
            </Select>
          </Field>
          <Field label="Alt obiectiv / detalii"><Input name="secondaryGoal" defaultValue={initial?.secondary_goal} /></Field>
          <Field label="Ce te interesează cel mai mult?">
            <Select name="interest" defaultValue={initial?.interest ?? ""}>
              <option value="">Alege opțional</option>
              <option value="REDUCERE_DURERE">Reducere durere</option>
              <option value="RECUPERARE_POSTOPERATORIE">Recuperare post-operatorie</option>
              <option value="TERAPIE_SPORTIVA">Terapie sportivă</option>
              <option value="WELLNESS_RELAXARE">Wellness / relaxare</option>
              <option value="PREVENTIE">Prevenție</option>
              <option value="ALTELE">Altele</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-zinc-600">
        <input name="communicationConsent" type="checkbox" defaultChecked={initial?.communication_consent ?? false} className="mt-0.5" />
        Sunt de acord să primesc comunicări non-medicale despre servicii și noutăți.
      </label>

      {state?.message && <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează profilul"}</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-zinc-700">{label}<span className="mt-1 block">{children}</span></label>;
}
