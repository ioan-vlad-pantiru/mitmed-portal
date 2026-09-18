"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ClipboardCheck, Home, MessageSquareText, Ruler, Save } from "lucide-react";
import { createMedicalRecord } from "@/actions/medicalRecords";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";
import { ChipGroup, PainScalePicker } from "@/components/ConsultChips";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
  clientId, appointmentId, therapyId, prevAppointmentId, nextAppointmentId,
}: {
  clientId: string; appointmentId: string; therapyId: string;
  prevAppointmentId: string | null; nextAppointmentId: string | null;
}) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>([]);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [notes, setNotes] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => { notesRef.current?.focus(); }, []);
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

  return <form action={action} className="flex flex-col gap-4 sm:overflow-y-auto sm:pb-2 sm:pr-1">
    <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="appointmentId" value={appointmentId} /><input type="hidden" name="therapyId" value={therapyId} /><input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} /><input type="hidden" name="fromConsult" value="1" />
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-sky-50 text-sky-700"><MessageSquareText size={17} /></span><div><h2 className="text-sm font-semibold text-zinc-900">S · Relatarea clientului</h2><p className="text-xs text-zinc-500">Simptome, schimbări de la ultima ședință, obiectivul zilei.</p></div></div><ChipGroup options={SUBJECTIVE_CHIPS} value={subjective} onChange={setSubjective} /><Textarea name="subjective" rows={2} className="mt-2" placeholder="Detalii suplimentare (opțional)…" value={subjective} onChange={(e) => setSubjective(e.target.value)} /></div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Ruler size={18} className="text-[var(--mitmed-teal)]" /><div><h2 className="text-sm font-semibold text-zinc-900">O · Observații și măsurători</h2><p className="text-xs text-zinc-500">ROM, scor durere, teste, toleranță.</p></div></div><PainScalePicker value={objective} onChange={setObjective} /><ChipGroup options={OBJECTIVE_CHIPS} value={objective} onChange={setObjective} /><Textarea name="objective" rows={2} className="mt-2" placeholder="Detalii suplimentare (opțional)…" value={objective} onChange={(e) => setObjective(e.target.value)} /></section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Activity size={18} className="text-[var(--mitmed-teal)]" /><div><h2 className="text-sm font-semibold text-zinc-900">A · Evaluare clinică</h2><p className="text-xs text-zinc-500">Progres, limitări rămase și precauții.</p></div></div><ChipGroup options={ASSESSMENT_CHIPS} value={assessment} onChange={setAssessment} /><Textarea name="assessment" rows={2} className="mt-2" placeholder="Detalii suplimentare (opțional)…" value={assessment} onChange={(e) => setAssessment(e.target.value)} /></section>
    </div>
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[var(--mitmed-teal)]" /><div><h2 className="text-sm font-semibold text-zinc-900">Intervenții efectuate și răspuns</h2><p className="text-xs text-zinc-500">Rezumatul ședinței — câmp obligatoriu.</p></div></div><label className="text-xs font-medium text-zinc-600">Diagnostic <Input name="diagnosis" className="ml-1 inline-block w-48" placeholder="Opțional" /></label></div><ChipGroup options={INTERVENTION_CHIPS} value={notes} onChange={setNotes} /><Textarea ref={notesRef} name="notes" required rows={3} className="mt-2" placeholder="Dozaj, răspunsul clientului și orice reacție relevantă…" value={notes} onChange={(e) => setNotes(e.target.value)} /></section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Home size={18} className="text-[var(--mitmed-teal)]" /><div><h2 className="text-sm font-semibold text-zinc-900">P · Plan următoare</h2><p className="text-xs text-zinc-500">Educație, exerciții pentru acasă, frecvență sau modificări.</p></div></div><ChipGroup options={PLAN_CHIPS} value={treatmentPlan} onChange={setTreatmentPlan} /><Textarea name="treatmentPlan" rows={2} className="mt-2" placeholder="Detalii suplimentare (opțional)…" value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} /></section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-zinc-900">Hartă corporală</h2><p className="mt-1 text-xs text-zinc-500">Marchează zona tratată sau dureroasă.</p><div className="mt-3 rounded-lg bg-zinc-50 p-2"><BodyMapPicker value={bodyMap} onChange={setBodyMap} /></div></section>
    </div>
    {state?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{state.message}</p>}
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 py-3 backdrop-blur"><span className="text-xs text-zinc-400">Esc ieșire · [ ] pacient anterior/următor</span><Button type="submit" disabled={pending}>{pending ? "Se salvează…" : <><Save size={16} /> Salvează și finalizează ședința</>}</Button></div>
  </form>;
}
