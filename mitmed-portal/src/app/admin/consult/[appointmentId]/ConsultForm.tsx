"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ClipboardCheck, ClipboardList, Home, ListChecks, MapPin, MessageSquareText, Ruler, Save } from "lucide-react";
import { createMedicalRecord } from "@/actions/medicalRecords";
import type { ConsultSessionRecord } from "@/actions/appointments";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";
import { ChipGroup, PainScalePicker } from "@/components/ConsultChips";
import { Input, Textarea } from "@/components/ui/Input";
import type { ConsultationSheetField } from "@/actions/consultationSheets";
import { TEMPLATE_TRATAMENT } from "@/lib/sheetTemplates";
import { AddSheetFieldInline, SheetFieldInputs } from "@/components/SheetFields";
import { Button } from "@/components/ui/Button";
import { TherapyCheckboxes } from "@/components/TherapyCheckboxes";
import { SavedSessionNotice } from "./SavedSessionNotice";
import { ConsultActionBar, ConsultSection } from "./ConsultSection";

const SUBJECTIVE_CHIPS = [
  "Fără durere", "Durere redusă", "Durere crescută", "Rigiditate dimineața",
  "Oboseală", "Progres resimțit de client", "Fără schimbări", "Anxietate/stres",
];

const OBJECTIVE_CHIPS = [
  "ROM normal", "ROM limitat", "Edem prezent", "Postură corectă",
  "Mers normal", "Mers antalgic", "Spasm muscular", "Sensibilitate la palpare",
];

const ASSESSMENT_CHIPS = [
  "Progres conform planului", "Progres lent", "Fără progres",
  "Necesită ajustarea planului", "Toleranță bună la tratament", "Precauție: evită încărcare",
];

const INTERVENTION_CHIPS = [
  "Mobilizare articulară", "Masaj terapeutic", "Exerciții terapeutice", "Stretching",
  "Electroterapie", "Termoterapie", "Kinetoterapie activă", "Tehnici de respirație",
  "Educație posturală",
];

const PLAN_CHIPS = [
  "Exerciții pentru acasă", "Continuă frecvența actuală", "Crește frecvența ședințelor",
  "Reevaluare la următoarea ședință", "Repaus recomandat", "Gheață/căldură acasă",
];

export function ConsultForm({
  clientId, appointmentId, therapies, defaultTherapyIds, savedRecord, prevAppointmentId, nextAppointmentId, extraFields, isAdmin,
}: {
  clientId: string; appointmentId: string;
  /** Therapies that can be ticked; the scheduled one is pre-ticked on a new record. */
  therapies: { id: string; name: string }[]; defaultTherapyIds: string[];
  /** Record already saved for the appointment: the Consult reopens and updates it. */
  savedRecord: ConsultSessionRecord | null;
  prevAppointmentId: string | null; nextAppointmentId: string | null;
  /** Căsuțele fișei de tratament adăugate de admin în Setări. */
  extraFields: ConsultationSheetField[]; isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>(savedRecord?.body_map ?? []);
  const [subjective, setSubjective] = useState(savedRecord?.subjective ?? "");
  const [objective, setObjective] = useState(savedRecord?.objective ?? "");
  const [assessment, setAssessment] = useState(savedRecord?.assessment ?? "");
  const [notes, setNotes] = useState(savedRecord?.notes ?? "");
  const [treatmentPlan, setTreatmentPlan] = useState(savedRecord?.treatment_plan ?? "");
  // Only an admin can correct an already documented session (same as in the patient file).
  const readOnly = savedRecord !== null && !isAdmin;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => { if (!savedRecord) notesRef.current?.focus(); }, [savedRecord]);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = ["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName ?? "");
      if (e.key === "Escape" && !typing) router.push("/admin");
      if (e.key === "[" && !typing && prevAppointmentId) router.push(`/admin/consult/${prevAppointmentId}`);
      if (e.key === "]" && !typing && nextAppointmentId) router.push(`/admin/consult/${nextAppointmentId}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, prevAppointmentId, nextAppointmentId]);

  return (
    <div className="flex flex-col gap-4 sm:overflow-y-auto sm:pb-2 sm:pr-1">
      {savedRecord && <SavedSessionNotice readOnly={readOnly} />}
      <form id="consult-form" action={action} className="flex flex-col gap-4">
        <fieldset disabled={readOnly} className="contents">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} />
          <input type="hidden" name="fromConsult" value="1" />

          <ConsultSection icon={ListChecks} title="Terapii efectuate" hint="Bifează tot ce s-a făcut în ședință.">
            <div className="mt-3">
              <TherapyCheckboxes
                therapies={therapies}
                selected={savedRecord ? savedRecord.therapies.map((t) => t.id) : defaultTherapyIds}
                hideLegend
              />
            </div>
          </ConsultSection>

          <ConsultSection icon={MessageSquareText} title="S · Relatarea clientului" visibility="internal" hint="Simptome, schimbări de la ultima ședință, obiectivul zilei.">
            <ChipGroup options={SUBJECTIVE_CHIPS} value={subjective} onChange={setSubjective} />
            <Textarea name="subjective" rows={2} className="mt-3" placeholder="Detalii suplimentare (opțional)…" value={subjective} onChange={(e) => setSubjective(e.target.value)} />
          </ConsultSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <ConsultSection icon={Ruler} title="O · Observații și măsurători" visibility="internal" hint="ROM, scor durere, teste, toleranță.">
              <PainScalePicker value={objective} onChange={setObjective} />
              <ChipGroup options={OBJECTIVE_CHIPS} value={objective} onChange={setObjective} />
              <Textarea name="objective" rows={2} className="mt-3" placeholder="Detalii suplimentare (opțional)…" value={objective} onChange={(e) => setObjective(e.target.value)} />
            </ConsultSection>
            <ConsultSection icon={Activity} title="A · Evaluare clinică" visibility="internal" hint="Progres, limitări rămase și precauții.">
              <ChipGroup options={ASSESSMENT_CHIPS} value={assessment} onChange={setAssessment} />
              <Textarea name="assessment" rows={2} className="mt-3" placeholder="Detalii suplimentare (opțional)…" value={assessment} onChange={(e) => setAssessment(e.target.value)} />
            </ConsultSection>
          </div>

          <ConsultSection
            icon={ClipboardCheck}
            title="Intervenții efectuate și răspuns"
            hint="Rezumatul ședinței — câmp obligatoriu. Clientul îl vede, împreună cu diagnosticul."
            visibility="client"
            aside={
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                Diagnostic
                <Input name="diagnosis" className="w-52" placeholder="Opțional" defaultValue={savedRecord?.diagnosis ?? ""} />
              </label>
            }
          >
            <ChipGroup options={INTERVENTION_CHIPS} value={notes} onChange={setNotes} />
            <Textarea ref={notesRef} name="notes" required rows={3} className="mt-3" placeholder="Dozaj, răspunsul clientului și orice reacție relevantă…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </ConsultSection>

          {(extraFields.length > 0 || isAdmin) && (
            <ConsultSection icon={ClipboardList} title="Căsuțe suplimentare" hint="Definite de admin. Clientul vede doar căsuțele marcate „Vede și clientul”.">
              <div className="mt-3 space-y-3">
                <SheetFieldInputs fields={extraFields} values={savedRecord?.field_values ?? {}} editable={isAdmin} />
              </div>
            </ConsultSection>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <ConsultSection icon={Home} title="P · Plan următoare" hint="Ce are clientul de făcut: exerciții, frecvență, recomandări. Apare primul în portalul lui." visibility="client">
              <ChipGroup options={PLAN_CHIPS} value={treatmentPlan} onChange={setTreatmentPlan} />
              <Textarea name="treatmentPlan" rows={2} className="mt-3" placeholder="Detalii suplimentare (opțional)…" value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} />
            </ConsultSection>
            <ConsultSection icon={MapPin} title="Hartă corporală" hint="Marchează zona tratată sau dureroasă." visibility="internal">
              <div className="mm-inset mt-3 p-2">
                <BodyMapPicker value={bodyMap} onChange={readOnly ? () => {} : setBodyMap} />
              </div>
            </ConsultSection>
          </div>
        </fieldset>
        {state?.message && <p data-variant="danger" className="mm-alert" role="alert">{state.message}</p>}
      </form>
      {isAdmin && <AddSheetFieldInline templateId={TEMPLATE_TRATAMENT} />}
      <ConsultActionBar hint="Esc ieșire · [ ] pacient anterior/următor">
        {!readOnly && (
          <Button type="submit" form="consult-form" disabled={pending}>
            {pending ? "Se salvează…" : <><Save size={16} /> {savedRecord ? "Salvează modificările" : "Salvează și finalizează ședința"}</>}
          </Button>
        )}
      </ConsultActionBar>
    </div>
  );
}
