"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createMedicalRecord } from "@/actions/medicalRecords";
import { BodyMapPicker, type BodyMapPoint } from "@/components/BodyMap";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ConsultForm({
  clientId,
  appointmentId,
  therapyId,
  prevAppointmentId,
  nextAppointmentId,
}: {
  clientId: string;
  appointmentId: string;
  therapyId: string;
  prevAppointmentId: string | null;
  nextAppointmentId: string | null;
}) {
  const [state, action, pending] = useActionState(createMedicalRecord, undefined);
  const [bodyMap, setBodyMap] = useState<BodyMapPoint[]>([]);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Notițele sunt primul lucru pe care operatorul îl scrie — zero click-uri
  // suplimentare ca să ajungă acolo la deschiderea ecranului.
  useEffect(() => {
    notesRef.current?.focus();
  }, []);

  // Esc = ieșire rapidă din consult, fără a salva. [ / ] = pacientul
  // anterior/următor din ziua curentă, fără a reveni la bord. Ignorate cât
  // timp se scrie într-un câmp, ca să nu interfereze cu textul notițelor.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      if (e.key === "Escape" && !typing) {
        router.push("/admin");
      } else if (e.key === "[" && !typing && prevAppointmentId) {
        router.push(`/admin/consult/${prevAppointmentId}`);
      } else if (e.key === "]" && !typing && nextAppointmentId) {
        router.push(`/admin/consult/${nextAppointmentId}`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, prevAppointmentId, nextAppointmentId]);

  return (
    <form action={action} className="flex flex-col gap-4 sm:overflow-y-auto sm:pb-2 sm:pr-1">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="therapyId" value={therapyId} />
      <input type="hidden" name="bodyMap" value={JSON.stringify(bodyMap)} />
      <input type="hidden" name="fromConsult" value="1" />

      <div>
        <label className="block text-xs font-medium text-zinc-700">Diagnostic</label>
        <Input name="diagnosis" className="mt-1" placeholder="Opțional" />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Notițe ședință</label>
        <Textarea ref={notesRef} name="notes" required rows={6} className="mt-1" />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Plan de tratament</label>
        <Textarea
          name="treatmentPlan"
          rows={3}
          className="mt-1"
          placeholder="Exerciții recomandate, frecvență, recomandări pentru acasă…"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700">Zonă tratată/dureroasă</label>
        <div className="mt-1 rounded-md border border-zinc-200 p-3">
          <BodyMapPicker value={bodyMap} onChange={setBodyMap} />
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <div className="mt-auto flex items-center gap-3 border-t border-zinc-100 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Salvează și finalizează ședința"}
        </Button>
        <span className="text-xs text-zinc-400">Esc ieșire · [ ] pacient anterior/următor</span>
      </div>
    </form>
  );
}
