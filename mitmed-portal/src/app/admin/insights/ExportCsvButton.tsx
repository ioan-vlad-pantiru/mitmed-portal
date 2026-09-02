"use client";

import { useTransition } from "react";
import { exportPaymentsCsv } from "@/actions/payments";

export function ExportCsvButton() {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const csv = await exportPaymentsCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "plati_mitmed.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      onClick={handleExport}
      disabled={pending}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
    >
      {pending ? "Se exportă…" : "Export CSV (contabilitate)"}
    </button>
  );
}
