"use client";

import { useState } from "react";
import Link from "next/link";
import { getOutstandingPayments, type OutstandingPayment } from "@/actions/insights";
import { MarkPaidControl } from "@/components/MarkPaidControl";
import { CorrectPaymentControl } from "@/components/CorrectPaymentControl";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";

const STATUS_LABEL: Record<OutstandingPayment["status"], string> = {
  NEPLATIT: "Neachitat",
  PARTIAL: "Parțial achitat",
};

export function OutstandingTrigger({ totalLabel }: { totalLabel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<OutstandingPayment[] | null>(null);

  function refetch() {
    setLoading(true);
    getOutstandingPayments()
      .then(setPayments)
      .finally(() => setLoading(false));
  }

  function handleOpen() {
    setOpen(true);
    if (payments === null) refetch();
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
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 border-b border-zinc-100 bg-white text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Terapie</th>
                  <th className="py-2 pr-3">Rest de plată</th>
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
                    <td className="mm-numeric py-2 pr-3 font-semibold text-zinc-900">
                      {p.remaining} RON
                      {p.status === "PARTIAL" && (
                        <span className="mm-numeric block text-xs font-normal text-zinc-400">
                          din {p.final_price} RON ({p.amount_paid} încasați)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={p.status === "PARTIAL" ? "warning" : "danger"}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-col items-end gap-1">
                        <MarkPaidControl
                          target={{ paymentId: p.id }}
                          clientId={p.client_id}
                          remaining={Number(p.remaining)}
                          onPaid={refetch}
                        />
                        {Number(p.amount_paid) > 0 && !p.paid_via_payu && (
                          <CorrectPaymentControl
                            target={{ paymentId: p.id }}
                            clientId={p.client_id}
                            currentAmountPaid={Number(p.amount_paid)}
                            onCorrected={refetch}
                          />
                        )}
                      </div>
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
