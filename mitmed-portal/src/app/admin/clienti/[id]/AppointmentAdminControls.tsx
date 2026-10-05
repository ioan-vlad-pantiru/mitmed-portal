"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAppointment, rescheduleAppointment } from "@/actions/appointments";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";

type Therapy = { id: string; name: string };

/** Data/ora locală a programării, pentru câmpurile date/time. */
function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Reprogramare și ștergere — doar pentru admin, oricând (inclusiv sub 48h,
 * ex. pacientul anunță cu o oră înainte că nu poate ajunge). */
export function AppointmentAdminControls({
  appointmentId,
  clientId,
  startsAt,
  therapyId,
  therapies,
}: {
  appointmentId: string;
  clientId: string;
  startsAt: string;
  therapyId: string;
  therapies: Therapy[];
}) {
  const [open, setOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-sky-600 hover:underline">
        Reprogramează
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          if (!window.confirm("Ștergi definitiv această programare? Plata neachitată asociată se șterge și ea.")) return;
          startDelete(async () => {
            const result = await deleteAppointment(appointmentId, clientId);
            if (result.ok) {
              toast.success("Programare ștearsă.");
              router.refresh();
            } else {
              toast.error(result.message);
            }
          });
        }}
        className="text-sm text-red-600 hover:underline disabled:opacity-60"
      >
        Șterge
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Reprogramează"
        description="Doar admin — se poate muta oricând, inclusiv cu mai puțin de 48h înainte."
      >
        {open && (
          <RescheduleForm
            appointmentId={appointmentId}
            clientId={clientId}
            startsAt={startsAt}
            therapyId={therapyId}
            therapies={therapies}
            onDone={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}

function RescheduleForm({
  appointmentId,
  clientId,
  startsAt,
  therapyId,
  therapies,
  onDone,
}: {
  appointmentId: string;
  clientId: string;
  startsAt: string;
  therapyId: string;
  therapies: Therapy[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(rescheduleAppointment.bind(null, appointmentId, clientId), undefined);
  const initial = localParts(startsAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const toast = useToast();

  useEffect(() => {
    if (!state?.success) return;
    toast.success(state.success);
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="startsAt" value={date && time ? `${date}T${time}` : ""} />
      <div>
        <label htmlFor="reschedule-therapy" className="block text-xs font-medium text-zinc-700">Terapie</label>
        <Select id="reschedule-therapy" name="therapyId" defaultValue={therapyId} className="mt-1">
          {therapies.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-zinc-700">
          Data
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          Ora
          <Input type="time" required step="300" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
        </label>
      </div>
      {state?.message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Renunță</Button>
        <Button type="submit" disabled={pending || !date || !time}>{pending ? "Se salvează…" : "Mută programarea"}</Button>
      </div>
    </form>
  );
}
