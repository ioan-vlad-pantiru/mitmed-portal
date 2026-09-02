"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { createPayment, previewPrice } from "@/actions/payments";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Therapy = { id: string; name: string; price: string | number; sessionsIncluded?: number };

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: string;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  therapies: { id: string; name: string }[];
};

type PackageItem = { therapy_id: string; therapy_name: string; sessions_included: number };
type TherapyPackage = { id: string; name: string; price: string; active: boolean; items: PackageItem[] };

const MANUAL_OPTION = "__manual__";
const NONE_OPTION = "";

export function PaymentForm({
  clientId,
  therapies,
  coupons,
  packages,
}: {
  clientId: string;
  therapies: Therapy[];
  coupons: Coupon[];
  packages: TherapyPackage[];
}) {
  const [state, action, pending] = useActionState(createPayment, undefined);
  const [saleMode, setSaleMode] = useState<"therapy" | "package">("therapy");
  const [therapyId, setTherapyId] = useState(therapies[0]?.id ?? "");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [couponCode, setCouponCode] = useState("");
  const [couponMode, setCouponMode] = useState<string>(NONE_OPTION); // coupon id, MANUAL_OPTION, or NONE_OPTION
  const [preview, setPreview] = useState<{ base_price: string; discount_amount: string; final_price: string } | null>(
    null
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();

  // Date.now() e impur — nu poate fi apelat direct în timpul randării (nici
  // memoizat). Inițializatorul lazy al useState e excepția sancționată: rulează
  // o singură dată, la montare, exact ce ne trebuie ca reper pentru filtrarea
  // cupoanelor valabile "acum".
  const [now] = useState(() => Date.now());

  const couponAppliesTo = (c: Coupon, tId: string) =>
    c.therapies.length === 0 || c.therapies.some((t) => t.id === tId);

  // Cupoane active, valabile acum, neepuizate și aplicabile terapiei alese
  // (sau fără restricție de terapie) — ce apare în listă de selectat rapid.
  const availableCoupons = useMemo(
    () =>
      coupons.filter((c) => {
        if (!c.active) return false;
        if (c.valid_from && new Date(c.valid_from).getTime() > now) return false;
        if (c.valid_until && new Date(c.valid_until).getTime() < now) return false;
        if (c.max_uses !== null && c.uses_count >= c.max_uses) return false;
        if (!couponAppliesTo(c, therapyId)) return false;
        return true;
      }),
    [coupons, therapyId, now]
  );

  function refreshPreview(nextTherapyId: string, nextCoupon: string) {
    if (!nextTherapyId) return;
    startPreview(async () => {
      const result = await previewPrice(nextTherapyId, nextCoupon || undefined);
      if (result.error || !result.base_price || !result.discount_amount || !result.final_price) {
        setPreviewError(result.error ?? null);
        setPreview(null);
      } else {
        setPreviewError(null);
        setPreview({
          base_price: result.base_price,
          discount_amount: result.discount_amount,
          final_price: result.final_price,
        });
      }
    });
  }

  function handleCouponModeChange(value: string) {
    setCouponMode(value);
    if (value === NONE_OPTION) {
      setCouponCode("");
      refreshPreview(therapyId, "");
    } else if (value === MANUAL_OPTION) {
      setCouponCode("");
    } else {
      const picked = coupons.find((c) => c.id === value);
      const code = picked?.code ?? "";
      setCouponCode(code);
      refreshPreview(therapyId, code);
    }
  }

  const selectedPackage = packages.find((p) => p.id === packageId);

  return (
    <form action={action} className="mt-3 space-y-3 mm-card p-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="saleMode" value={saleMode} />

      {/* Comutator terapie individuală / pachet — doar dacă există pachete
          active, altfel nu are sens să arătăm o alegere fără al doilea braț. */}
      {packages.length > 0 && (
        <div className="flex gap-1 rounded-md bg-zinc-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setSaleMode("therapy")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              saleMode === "therapy" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            Terapie individuală
          </button>
          <button
            type="button"
            onClick={() => setSaleMode("package")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              saleMode === "package" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            Pachet
          </button>
        </div>
      )}

      {saleMode === "package" ? (
        <div>
          <label className="block text-xs font-medium text-zinc-700">Pachet</label>
          <Select name="packageId" value={packageId} onChange={(e) => setPackageId(e.target.value)} className="mt-1">
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.price} RON
              </option>
            ))}
          </Select>
          {selectedPackage && (
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
              {selectedPackage.items.map((i) => (
                <li key={i.therapy_id}>
                  {i.sessions_included}× {i.therapy_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Terapie</label>
              <Select
                name="therapyId"
                value={therapyId}
                className="mt-1"
                onChange={(e) => {
                  const nextTherapyId = e.target.value;
                  setTherapyId(nextTherapyId);

                  // Dacă cuponul ales din listă nu se mai aplică terapiei noi,
                  // resetează selecția în loc să trimită un cod care nu se mai potrivește.
                  const stillApplies =
                    couponMode === NONE_OPTION ||
                    couponMode === MANUAL_OPTION ||
                    coupons.some((c) => c.id === couponMode && couponAppliesTo(c, nextTherapyId));

                  if (!stillApplies) {
                    setCouponMode(NONE_OPTION);
                    setCouponCode("");
                    refreshPreview(nextTherapyId, "");
                  } else {
                    refreshPreview(nextTherapyId, couponCode);
                  }
                }}
              >
                {therapies.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.sessionsIncluded && t.sessionsIncluded > 1 ? ` (pachet ${t.sessionsIncluded}×)` : ""} — {t.price} RON
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Cupon</label>
              <Select value={couponMode} onChange={(e) => handleCouponModeChange(e.target.value)} className="mt-1">
                <option value={NONE_OPTION}>Fără cupon</option>
                {availableCoupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.value}
                    {c.type === "PROCENT" ? "%" : " RON"}
                  </option>
                ))}
                <option value={MANUAL_OPTION}>Alt cod (introdu manual)…</option>
              </Select>
            </div>
          </div>

          {couponMode === MANUAL_OPTION && (
            <div>
              <label className="block text-xs font-medium text-zinc-700">Cod cupon</label>
              <Input
                name="couponCode"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  refreshPreview(therapyId, e.target.value);
                }}
                className="mt-1 max-w-xs uppercase"
              />
            </div>
          )}
          {couponMode !== MANUAL_OPTION && <input type="hidden" name="couponCode" value={couponCode} />}

          {isPreviewing && <p className="text-sm text-zinc-400">Se calculează…</p>}
          {previewError && <p className="text-sm text-red-600">{previewError}</p>}
          {preview && !previewError && (
            <p className="text-sm text-zinc-700">
              Preț bază: {preview.base_price} RON · Reducere: {preview.discount_amount} RON ·{" "}
              <strong>Total: {preview.final_price} RON</strong>
            </p>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Metodă</label>
          <Select name="method" className="mt-1">
            <option value="numerar">Numerar</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
          </Select>
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="markPaid" value="1" />
          Marchează ca plătită acum
        </label>
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează…" : "Înregistrează plată"}
      </Button>
    </form>
  );
}
