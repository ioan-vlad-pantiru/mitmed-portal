"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, Clock3, Stethoscope } from "lucide-react";
import { createAppointmentForClient } from "@/actions/appointments";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string; duration_minutes: number };

const CLINIC_OPENS_AT = "10:00";
const CLINIC_CLOSES_AT = "18:00";

function formatDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

function isWeekday(value: string) {
  if (!value) return true;
  const day = new Date(`${value}T12:00:00`).getDay();
  return day !== 0 && day !== 6;
}

/** Ora selectată trebuie să fie în intervalul 10:00-18:00, iar ședința (în
 * funcție de durata terapiei) trebuie să se încheie până la ora 18:00. */
function fitsBusinessHours(time: string, durationMinutes: number) {
  if (!time) return true;
  const [h, m] = time.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const [openH, openM] = CLINIC_OPENS_AT.split(":").map(Number);
  const [closeH, closeM] = CLINIC_CLOSES_AT.split(":").map(Number);
  return startMinutes >= openH * 60 + openM && startMinutes + durationMinutes <= closeH * 60 + closeM;
}

export function AppointmentForm({ clientId, therapies }: { clientId: string; therapies: Therapy[] }) {
  const action = createAppointmentForClient.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [date, setDate] = useState("");
  const [time, setTime] = useState(CLINIC_OPENS_AT);
  const [therapyId, setTherapyId] = useState(therapies[0]?.id ?? "");
  const appointmentValue = useMemo(() => formatDateTime(date, time), [date, time]);
  const weekdaySelected = isWeekday(date);
  const selectedTherapy = therapies.find((t) => t.id === therapyId);
  const withinHours = fitsBusinessHours(time, selectedTherapy?.duration_minutes ?? 0);

  return (
    <form action={formAction} className="mt-3 grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-2">
      <input type="hidden" name="startsAt" value={appointmentValue} />
      <div className="md:col-span-2"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--mitmed-sky)]/15 text-[var(--mitmed-teal)]"><CalendarPlus size={17} /></span><div><h3 className="text-sm font-semibold text-zinc-900">Programare nouă</h3><p className="text-xs text-zinc-500">Alege serviciul, apoi stabilește exact ziua și ora.</p></div></div></div>
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700"><Stethoscope size={14} /> Terapie</label>
        <Select name="therapyId" value={therapyId} onChange={(event) => setTherapyId(event.target.value)} className="mt-1.5">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-700">Data<Input type="date" required value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} className="mt-1.5" /></label>
        <label className="block text-xs font-medium text-zinc-700"><span className="flex items-center gap-1.5"><Clock3 size={14} /> Ora</span><Input type="time" required value={time} step="300" min={CLINIC_OPENS_AT} max={CLINIC_CLOSES_AT} onChange={(event) => setTime(event.target.value)} className="mt-1.5" /></label>
      </div>

      {state?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 md:col-span-2">{state.message}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 md:col-span-2">
        <p className={`text-xs ${weekdaySelected && withinHours ? "text-zinc-400" : "font-medium text-red-600"}`}>
          {!weekdaySelected
            ? "Selectează o zi de luni până vineri."
            : !withinHours
              ? "Programul clinicii este 10:00-18:00 — ședința trebuie să se încheie până la ora 18:00."
              : "Programul clinicii: luni-vineri, 10:00-18:00."}
        </p>
        <Button type="submit" disabled={pending || !weekdaySelected || !withinHours}>
          {pending ? "Se programează…" : "Creează programarea"}
        </Button>
      </div>
    </form>
  );
}
