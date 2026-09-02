"use client";

import { useTransition } from "react";
import { exportPaymentsCsv } from "@/actions/payments";
import { Button } from "@/components/ui/Button";

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
    <Button variant="secondary" onClick={handleExport} disabled={pending} className="text-xs">
      {pending ? "Se exportă…" : "Export CSV (contabilitate)"}
    </Button>
  );
}
