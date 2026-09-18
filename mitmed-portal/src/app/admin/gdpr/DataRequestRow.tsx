"use client";

import { useState, useTransition } from "react";
import { completeDataSubjectRequest, rejectDataSubjectRequest, type DataSubjectRequestSummary } from "@/actions/clients";
import { useToast } from "@/components/Toast";

export function DataRequestRow({ request }: { request: DataSubjectRequestSummary }) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const toast = useToast();

  const complete = () =>
    startTransition(async () => {
      try {
        await completeDataSubjectRequest(request.id);
        toast.success("Cont anonimizat. Fișele medicale/financiare au fost păstrate conform legii.");
      } catch {
        toast.error("Nu am putut finaliza cererea.");
      }
    });

  const reject = () =>
    startTransition(async () => {
      try {
        await rejectDataSubjectRequest(request.id, note);
        toast.success("Cerere respinsă.");
      } catch {
        toast.error("Nu am putut respinge cererea.");
      }
      setRejecting(false);
    });

  return (
    <div className="mm-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{request.client_name}</p>
          <p className="text-xs text-zinc-500">
            Cerere de ștergere · {new Date(request.created_at).toLocaleDateString("ro-RO")}
          </p>
        </div>
        {!rejecting && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={complete}
              className="rounded-md bg-[var(--mitmed-teal)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-50"
            >
              Anonimizează contul
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRejecting(true)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              Respinge
            </button>
          </div>
        )}
      </div>

      {rejecting && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motiv respingere (vizibil în jurnalul de audit)"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--mitmed-sky)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !note.trim()}
              onClick={reject}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirmă respingerea
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Renunță
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
