import { CreditCard, Gift, PackageCheck } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { listOwnFidelityCards } from "@/actions/fidelity";
import { PayOnlineButton } from "@/components/PayOnlineButton";

type PaymentStatus = "NEPLATIT" | "PARTIAL" | "PLATIT";
type Payment = {
  id: string;
  created_at: string;
  final_price: string;
  status: PaymentStatus;
  therapy: { name: string };
  coupon: { code: string } | null;
  package_total_sessions: number | null;
  sessions_used: number;
  package_name: string | null;
  package_purchase_id: string | null;
};

const STATUS_LABEL: Record<PaymentStatus, string> = { PLATIT: "Achitat", PARTIAL: "Parțial achitat", NEPLATIT: "Neachitat" };
const STATUS_VARIANT: Record<PaymentStatus, string> = { PLATIT: "paid", PARTIAL: "partial", NEPLATIT: "unpaid" };

export default async function PaymentsPage() {
  const [raw, fidelityCards] = await Promise.all([getOwnClientData(), listOwnFidelityCards()]);
  const client = raw as { payments: Payment[] };
  const packages = client.payments.filter((item) => item.package_total_sessions);

  return (
    <div className="portal-subpage">
      <header>
        <p>Plăți și pachete</p>
        <h1>O imagine clară a ședințelor tale.</h1>
        <span>Urmărește pachetele active și istoricul plăților.</span>
      </header>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <PackageCheck />
          <h2>Pachetele mele</h2>
        </div>
        {packages.length ? (
          <div className="portal-package-grid">
            {packages.map((item) => {
              const total = item.package_total_sessions ?? 1;
              const progress = Math.min(100, (item.sessions_used / total) * 100);
              return (
                <div key={item.id}>
                  <div className="portal-package-head">
                    <span className="portal-package-icon">
                      <PackageCheck size={16} />
                    </span>
                    <div>
                      <strong>{item.package_name ?? item.therapy.name}</strong>
                      <span>{item.therapy.name}</span>
                    </div>
                  </div>
                  <div className="portal-package-progress-row">
                    <span>
                      {item.sessions_used} din {total} ședințe
                    </span>
                    <b>{Math.round(progress)}%</b>
                  </div>
                  <div className="portal-package-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="portal-quiet">Nu ai pachete active în acest moment.</p>
        )}
      </section>

      {fidelityCards.length > 0 && (
        <section className="portal-feature-panel">
          <div className="portal-panel-title">
            <Gift />
            <h2>Cardurile mele de fidelitate</h2>
          </div>
          <div className="portal-package-grid">
            {fidelityCards.map((card) => {
              const position = card.cycle_length > 0 ? (card.stamps % card.cycle_length) + 1 : card.stamps + 1;
              const progress = card.cycle_length > 0 ? Math.min(100, (position / card.cycle_length) * 100) : 0;
              const program = card.tiers
                .slice()
                .sort((a, b) => a.session_number - b.session_number)
                .map((t) => `a ${t.session_number}-a -${Number(t.discount_percent)}%`)
                .join(", ");
              return (
                <div key={card.id}>
                  <div className="portal-package-head">
                    <span className="portal-package-icon">
                      <Gift size={16} />
                    </span>
                    <div>
                      <strong>{card.card_type_name}</strong>
                      <span>{card.therapy_name}</span>
                    </div>
                  </div>
                  {card.next_discount_percent && (
                    <p className="mt-1 text-sm font-medium text-emerald-700">
                      Următoarea ședință are -{Number(card.next_discount_percent)}%!
                    </p>
                  )}
                  <div className="portal-package-progress-row">
                    <span>
                      Ședința {position} din {card.cycle_length}
                    </span>
                    <b>{Math.round(progress)}%</b>
                  </div>
                  <div className="portal-package-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Program: {program}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <CreditCard />
          <h2>Istoric tranzacții</h2>
        </div>
        <div className="portal-payment-history">
          {client.payments.map((item) => (
            <div key={item.id}>
              <span className="portal-payment-history-icon">
                <CreditCard size={16} />
              </span>
              <span>
                <strong>{item.therapy.name}</strong>
                <span className="portal-payment-history-meta">
                  {new Date(item.created_at).toLocaleDateString("ro-RO")}
                  {item.coupon && ` · Cupon ${item.coupon.code}`}
                </span>
              </span>
              <span className="portal-status-cell">
                <span className="portal-status-badge" data-variant={STATUS_VARIANT[item.status]}>
                  {STATUS_LABEL[item.status]}
                </span>
                {item.status !== "PLATIT" && <PayOnlineButton paymentId={item.id} className="portal-pay-btn" />}
              </span>
              <b>{item.final_price} RON</b>
            </div>
          ))}
          {!client.payments.length && <p className="portal-quiet">Nu există plăți încă.</p>}
        </div>
      </section>
    </div>
  );
}
