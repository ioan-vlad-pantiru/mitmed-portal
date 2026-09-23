"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, Clock3, Stethoscope } from "lucide-react";
import { createAppointmentForClient } from "@/actions/appointments";
import type { WeekdayHours, Vacation } from "@/actions/clinic";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string; duration_minutes: number };

const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

function formatDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

// date.getDay() (0=duminică…6=sâmbătă) -> convenția backend-ului
// (0=luni…6=duminică, ca Python date.weekday()).
function toBackendWeekday(value: string): number {
  const jsDay = new Date(`${value}T12:00:00`).getDay();
  return (jsDay + 6) % 7;
}

function vacationFor(value: string, vacations: Vacation[]): Vacation | undefined {
  return vacations.find((v) => v.starts_on <= value && value <= v.ends_on);
}

export function AppointmentForm({
  clientId,
  therapies,
  hours,
  vacations,
}: {
  clientId: string;
  therapies: Therapy[];
  hours: WeekdayHours[];
  vacations: Vacation[];
}) {
  const action = createAppointmentForClient.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [date, setDate] = useState("");
  const dayHours = date ? hours.find((h) => h.weekday === toBackendWeekday(date)) : undefined;
  const [time, setTime] = useState("");
  const [therapyId, setTherapyId] = useState(therapies[0]?.id ?? "");
  const appointmentValue = useMemo(() => formatDateTime(date, time), [date, time]);
  const selectedTherapy = therapies.find((t) => t.id === therapyId);
  const duration = selectedTherapy?.duration_minutes ?? 0;
  const onVacation = date ? vacationFor(date, vacations) : undefined;
  const isOpenDay = Boolean(dayHours?.is_open && dayHours.opens_at && dayHours.closes_at) && !onVacation;

  const opensAt = dayHours?.opens_at?.slice(0, 5) ?? "";
  const closesAt = dayHours?.closes_at?.slice(0, 5) ?? "";
  const breakStartsAt = dayHours?.break_starts_at?.slice(0, 5);
  const breakEndsAt = dayHours?.break_ends_at?.slice(0, 5);

  const withinHours =
    !isOpenDay || !time
      ? true
      : toMinutes(time) >= toMinutes(opensAt) && toMinutes(time) + duration <= toMinutes(closesAt);
  const outsideBreak =
    !isOpenDay || !time || !breakStartsAt || !breakEndsAt
      ? true
      : toMinutes(time) + duration <= toMinutes(breakStartsAt) || toMinutes(time) >= toMinutes(breakEndsAt);

  const canSubmit = Boolean(date && time && isOpenDay && withinHours && outsideBreak);

  let hint = "Alege o zi ca să vezi programul cabinetului.";
  if (date) {
    if (onVacation) hint = `Cabinetul e închis în această zi (${onVacation.label || "vacanță"}).`;
    else if (!isOpenDay) hint = "Cabinetul este închis în această zi.";
    else if (!withinHours) hint = `Programul zilei este ${opensAt}-${closesAt} — ședința trebuie să se încheie în acest interval.`;
    else if (!outsideBreak) hint = `Între ${breakStartsAt} și ${breakEndsAt} este pauză — ședința trebuie să se încheie înainte sau să înceapă după.`;
    else hint = breakStartsAt ? `Program: ${opensAt}-${closesAt}, pauză ${breakStartsAt}-${breakEndsAt}.` : `Program: ${opensAt}-${closesAt}.`;
  }

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
        <label className="block text-xs font-medium text-zinc-700">Data<Input type="date" required value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="mt-1.5" /></label>
        <label className="block text-xs font-medium text-zinc-700">
          <span className="flex items-center gap-1.5"><Clock3 size={14} /> Ora</span>
          <Input
            type="time"
            required
            value={time}
            step="300"
            min={isOpenDay ? opensAt : undefined}
            max={isOpenDay ? closesAt : undefined}
            disabled={!isOpenDay}
            onChange={(event) => setTime(event.target.value)}
            className="mt-1.5"
          />
        </label>
      </div>

      {state?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 md:col-span-2">{state.message}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 md:col-span-2">
        <p className={`text-xs ${!date || (isOpenDay && withinHours && outsideBreak) ? "text-zinc-400" : "font-medium text-red-600"}`}>{hint}</p>
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? "Se programează…" : "Creează programarea"}
        </Button>
      </div>
    </form>
  );
}
