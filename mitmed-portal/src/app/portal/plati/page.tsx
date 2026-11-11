import { CreditCard, Gift, PackageCheck } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { listOwnFidelityCards } from "@/actions/fidelity";
import { FidelityCardProgress } from "@/components/FidelityProgress";
import { PayOnlineButton } from "@/components/PayOnlineButton";
import { PortalPageHeader } from "../_components/PortalPageHeader";
import { formatRon } from "@/lib/format";
import { amountDue, unpaidPayments } from "../portalData";

type PaymentStatus = "NEPLATIT" | "PARTIAL" | "PLATIT";
type Payment = {
  id: string;
  created_at: string;
  final_price: string;
  amount_paid: string;
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
  const unpaid = unpaidPayments(client.payments);
  const unpaidTotal = unpaid.reduce((sum, item) => sum + amountDue(item), 0);

  return (
    <div className="portal-subpage">
      <PortalPageHeader title="Plăți și pachete" />

      {unpaid.length > 0 ? (
        <section className="portal-due-panel" aria-labelledby="due-title">
          <p id="due-title" className="portal-due-label">De plată</p>
          <p className="portal-due-total">{formatRon(unpaidTotal)}</p>
          <p className="portal-due-hint">Poți plăti online acum, sau la recepție când vii.</p>
          <ul className="portal-due-list">
            {unpaid.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.package_name ?? item.therapy.name}</strong>
                  <small>
                    {new Date(item.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}
                    {item.status === "PARTIAL" ? ` · ai plătit deja ${item.amount_paid} RON` : ""}
                  </small>
                </span>
                <b>{formatRon(amountDue(item))}</b>
                <PayOnlineButton paymentId={item.id} className="portal-primary-btn portal-btn-sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="portal-due-panel is-clear">
          <p className="portal-due-label">De plată</p>
          <p className="portal-due-total">0 RON</p>
          <p className="portal-due-hint">Totul este achitat. Mulțumim!</p>
        </section>
      )}

      {packages.length > 0 && (
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
      )}

      {fidelityCards.length > 0 && (
        <section className="portal-feature-panel">
          <div className="portal-panel-title">
            <Gift />
            <h2>Cardurile mele de fidelitate</h2>
          </div>
          <div className="portal-package-grid">
            {fidelityCards.map((card) => (
              <div key={card.id}>
                <div className="portal-package-head">
                  <span className="portal-package-icon">
                    <Gift size={16} />
                  </span>
                  <div>
                    <strong>{card.card_type_name}</strong>
                    <span>{card.therapies.map((t) => t.therapy_name).join(", ")}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <FidelityCardProgress card={card} audience="client" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <CreditCard />
          <h2>Istoricul plăților</h2>
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
              </span>
              <b>
                {item.status === "PARTIAL" ? (
                  <>
                    {formatRon(amountDue(item))} rest
                    <span className="mm-numeric block text-xs font-normal text-zinc-400">
                      din {item.final_price} RON, {item.amount_paid} încasați
                    </span>
                  </>
                ) : (
                  `${item.final_price} RON`
                )}
              </b>
            </div>
          ))}
          {!client.payments.length && <p className="portal-quiet">Nu există plăți încă.</p>}
        </div>
      </section>
    </div>
  );
}
