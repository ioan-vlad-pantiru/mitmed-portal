"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getOutstandingPayments, type OutstandingPayment } from "@/actions/insights";
import { markPaymentPaid } from "@/actions/payments";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STATUS_LABEL: Record<OutstandingPayment["status"], string> = {
  NEPLATIT: "Neachitat",
  PARTIAL: "Parțial achitat",
};

export function OutstandingTrigger({ totalLabel }: { totalLabel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<OutstandingPayment[] | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    if (payments === null) {
      setLoading(true);
      getOutstandingPayments()
        .then(setPayments)
        .finally(() => setLoading(false));
    }
  }

  function handlePay(paymentId: string, clientId: string) {
    setPayingId(paymentId);
    startTransition(async () => {
      await markPaymentPaid(paymentId, clientId);
      setPayments((prev) => prev?.filter((p) => p.id !== paymentId) ?? null);
      setPayingId(null);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="mm-card block w-full p-5 text-left transition-shadow hover:shadow-[var(--mm-shadow-lg)]"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <span className="text-orange-600">!</span>
        </span>
        <div className="mm-numeric mt-3 text-3xl font-bold tracking-tight text-orange-700">{totalLabel}</div>
        <div className="text-sm text-zinc-500">Sume neîncasate — apasă pentru detalii</div>
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Sume neîncasate"
        description="Plăți neachitate sau parțial achitate, cel mai vechi caz primul."
        size="lg"
      >
        {loading && <p className="py-6 text-center text-sm text-zinc-400">Se încarcă…</p>}
        {!loading && payments?.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">Nicio sumă neîncasată. 🎉</p>
        )}
        {!loading && payments && payments.length > 0 && (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 border-b border-zinc-100 bg-white text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Terapie</th>
                  <th className="py-2 pr-3">Sumă</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 font-medium text-zinc-900">
                      <Link href={`/admin/clienti/${p.client_id}`} className="hover:underline">
                        {p.client_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">{p.therapy_name}</td>
                    <td className="mm-numeric py-2 pr-3 font-semibold text-zinc-900">{p.final_price} RON</td>
                    <td className="py-2 pr-3">
                      <Badge variant={p.status === "PARTIAL" ? "warning" : "danger"}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        variant="success"
                        className="text-xs"
                        disabled={isPending && payingId === p.id}
                        onClick={() => handlePay(p.id, p.client_id)}
                      >
                        {isPending && payingId === p.id ? "Se salvează…" : "Marchează plătit"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </>
  );
}
