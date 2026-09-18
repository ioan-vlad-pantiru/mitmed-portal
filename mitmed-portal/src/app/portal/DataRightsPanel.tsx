"use client";

import { useState, useTransition } from "react";
import { exportOwnData, requestOwnDataErasure } from "@/actions/clients";
import { useToast } from "@/components/Toast";

export function DataRightsPanel() {
  const [exporting, startExport] = useTransition();
  const [erasing, startErasure] = useTransition();
  const [confirmingErasure, setConfirmingErasure] = useState(false);
  const toast = useToast();

  const handleExport = () =>
    startExport(async () => {
      const data = await exportOwnData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mitmed-datele-mele-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

  const handleErasureRequest = () =>
    startErasure(async () => {
      const result = await requestOwnDataErasure();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      setConfirmingErasure(false);
    });

  return (
    <section className="portal-feature-panel">
      <div className="portal-panel-title">
        <h2>Datele tale</h2>
      </div>
      <p className="portal-quiet">
        Conform GDPR, poți descărca oricând o copie a datelor tale sau poți solicita ștergerea contului. Fișele
        medicale și financiare sunt păstrate conform obligațiilor legale de arhivare, chiar și după o cerere de
        ștergere — vezi{" "}
        <a href="/confidentialitate" className="font-medium text-[var(--mitmed-teal)] hover:underline">
          Politica de confidențialitate
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          {exporting ? "Se pregătește…" : "Descarcă datele mele"}
        </button>

        {!confirmingErasure ? (
          <button
            type="button"
            onClick={() => setConfirmingErasure(true)}
            className="text-sm font-medium text-red-600 underline-offset-2 hover:underline"
          >
            Solicită ștergerea contului
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-600">Sigur? Recepția va soluționa cererea în cel mult 30 de zile.</span>
            <button
              type="button"
              disabled={erasing}
              onClick={handleErasureRequest}
              className="font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Da, trimite cererea
            </button>
            <button
              type="button"
              onClick={() => setConfirmingErasure(false)}
              className="text-zinc-400 underline-offset-2 hover:underline"
            >
              Renunță
            </button>
          </span>
        )}
      </div>
    </section>
  );
}
