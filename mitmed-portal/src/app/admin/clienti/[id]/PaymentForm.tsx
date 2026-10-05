"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMultiPayment,
  createPayment,
  previewMultiPayment,
  type MultiPaymentPreview,
} from "@/actions/payments";
import { useToast } from "@/components/Toast";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IconTrash } from "@/components/icons";
import { CLINIC_TIME_ZONE } from "@/lib/clinic";

type Therapy = { id: string; name: string; price: string | number };

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

/** O programare a clientului, cu starea plății ei — vezi page.tsx. */
export type PayableBooking = {
  id: string;
  therapyId: string;
  therapyName: string;
  startsAt: string;
  status: string;
  /** Starea plății legate de programare; null = nicio plată încă. */
  paymentStatus: "NEPLATIT" | "PARTIAL" | "PLATIT" | null;
  /** Clientul are un pachet activ pe terapia programării (se scade la consult). */
  coveredByPackage: boolean;
};

type Line = { key: number; therapyId: string; appointmentId: string | null };

const MANUAL_OPTION = "__manual__";
const NONE_OPTION = "";

function formatSession(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

// O programare acoperită de un pachet activ se scade din pachet la consult —
// nu se plătește separat (și deci nu contează la cardul de fidelitate).
function isPayable(b: PayableBooking) {
  if (b.status === "ANULATA") return false;
  if (b.paymentStatus === "NEPLATIT") return true;
  return b.paymentStatus === null && !b.coveredByPackage;
}

function BookingPaymentBadge({ booking }: { booking: PayableBooking }) {
  if (booking.status === "ANULATA") return <span className="text-xs text-zinc-400">anulată</span>;
  if (booking.paymentStatus === "PLATIT") return <span data-variant="success" className="mm-badge">Achitată</span>;
  if (booking.paymentStatus === "PARTIAL") return <span data-variant="warning" className="mm-badge">Parțial achitată</span>;
  if (booking.paymentStatus === "NEPLATIT") return <span data-variant="danger" className="mm-badge">Neachitată</span>;
  if (booking.coveredByPackage) return <span data-variant="neutral" className="mm-badge">Din pachet</span>;
  return <span data-variant="neutral" className="mm-badge">Fără plată</span>;
}

export function PaymentForm({
  clientId,
  therapies,
  coupons,
  packages,
  bookings,
}: {
  clientId: string;
  therapies: Therapy[];
  coupons: Coupon[];
  packages: TherapyPackage[];
  bookings: PayableBooking[];
}) {
  const [packageState, packageAction, packagePending] = useActionState(createPayment, undefined);
  const [saleMode, setSaleMode] = useState<"therapy" | "package">("therapy");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    therapies[0] ? [{ key: 0, therapyId: therapies[0].id, appointmentId: null }] : []
  );
  const nextKey = useRef(1);
  const [couponCode, setCouponCode] = useState("");
  const [couponMode, setCouponMode] = useState<string>(NONE_OPTION); // coupon id, MANUAL_OPTION, or NONE_OPTION
  const [method, setMethod] = useState("numerar");
  const [amountPaid, setAmountPaid] = useState("");
  const [preview, setPreview] = useState<MultiPaymentPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [showAllBookings, setShowAllBookings] = useState(false);
  const toast = useToast();
  const router = useRouter();

  // Date.now() e impur — nu poate fi apelat direct în timpul randării (nici
  // memoizat). Inițializatorul lazy al useState e excepția sancționată.
  const [now] = useState(() => Date.now());

  const lineTherapyIds = useMemo(() => new Set(lines.map((l) => l.therapyId)), [lines]);

  // Cupoane active, valabile acum, neepuizate și aplicabile măcar unei linii.
  const availableCoupons = useMemo(
    () =>
      coupons.filter((c) => {
        if (!c.active) return false;
        if (c.valid_from && new Date(c.valid_from).getTime() > now) return false;
        if (c.valid_until && new Date(c.valid_until).getTime() < now) return false;
        if (c.max_uses !== null && c.uses_count >= c.max_uses) return false;
        return c.therapies.length === 0 || c.therapies.some((t) => lineTherapyIds.has(t.id));
      }),
    [coupons, lineTherapyIds, now]
  );

  // Recalculează totalul (cu fidelitatea pe fiecare linie, în ordine) la
  // fiecare schimbare — cu o mică întârziere, ca tastarea unui cod de cupon
  // să nu trimită o cerere la fiecare literă. Răspunsurile vechi se ignoră.
  const requestId = useRef(0);
  useEffect(() => {
    if (saleMode !== "therapy" || lines.length === 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setPreviewing(true);
      previewMultiPayment({
        clientId,
        lines: lines.map((l) => ({ therapyId: l.therapyId, appointmentId: l.appointmentId })),
        couponCode,
      }).then((result) => {
        if (id !== requestId.current) return;
        setPreviewing(false);
        if (result.ok) {
          setPreview(result.preview);
          setPreviewError(null);
        } else {
          setPreview(null);
          setPreviewError(result.message);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [clientId, lines, couponCode, saleMode]);

  function addLine(therapyId: string, appointmentId: string | null = null) {
    setLines((current) => [...current, { key: nextKey.current++, therapyId, appointmentId }]);
  }

  function toggleBooking(booking: PayableBooking) {
    const existing = lines.find((l) => l.appointmentId === booking.id);
    if (existing) {
      setLines((current) => current.filter((l) => l.key !== existing.key));
      return;
    }
    // O linie goală (terapie aleasă, fără programare) a aceleiași terapii se
    // leagă de programare în loc să adauge una nouă — cazul obișnuit "a
    // venit la masaj, încasez masajul de azi".
    const loose = lines.find((l) => !l.appointmentId && l.therapyId === booking.therapyId);
    if (loose) {
      setLines((current) => current.map((l) => (l.key === loose.key ? { ...l, appointmentId: booking.id } : l)));
    } else {
      addLine(booking.therapyId, booking.id);
    }
  }

  function handleCouponModeChange(value: string) {
    setCouponMode(value);
    if (value === NONE_OPTION || value === MANUAL_OPTION) {
      setCouponCode("");
    } else {
      setCouponCode(coupons.find((c) => c.id === value)?.code ?? "");
    }
  }

  const selectedPackage = packages.find((p) => p.id === packageId);
  const total = saleMode === "package" ? Number(selectedPackage?.price ?? 0) : Number(preview?.final_price ?? 0);
  const bookingsById = new Map(bookings.map((b) => [b.id, b]));
  const sortedBookings = bookings
    .slice()
    .sort((a, b) => Number(isPayable(b)) - Number(isPayable(a)) || new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const visibleBookings = showAllBookings ? sortedBookings : sortedBookings.slice(0, 6);

  function submitTherapies() {
    startSaving(async () => {
      const result = await createMultiPayment({
        clientId,
        lines: lines.map((l) => ({ therapyId: l.therapyId, appointmentId: l.appointmentId })),
        couponCode,
        method,
        amountPaid: amountPaid.trim() ? Number(amountPaid) : null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(lines.length > 1 ? `Plată înregistrată pentru ${lines.length} terapii.` : "Plată înregistrată.");
      setLines(therapies[0] ? [{ key: nextKey.current++, therapyId: therapies[0].id, appointmentId: null }] : []);
      setAmountPaid("");
      setCouponMode(NONE_OPTION);
      setCouponCode("");
      router.refresh();
    });
  }

  const methodAndAmount = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Metodă</label>
        <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1">
          <option value="numerar">Numerar</option>
          <option value="card">Card</option>
          <option value="transfer">Transfer</option>
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Sumă încasată acum (opțional)</label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            name="amountPaid"
            type="number"
            min={0}
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0"
            className="max-w-[130px]"
          />
          {total > 0 && (
            <button
              type="button"
              onClick={() => setAmountPaid(total.toFixed(2))}
              className="text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
            >
              Integral ({total.toFixed(2)} RON)
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Lasă gol pentru neîncasat — o sumă mai mică decât totalul se aplică terapiilor în ordine; restul rămâne de
          încasat mai târziu.
        </p>
      </div>
    </div>
  );

  return (
    <div className="mt-3 space-y-3 mm-card p-4">
      {/* Comutator terapii / pachet — doar dacă există pachete active. */}
      {packages.length > 0 && (
        <div className="flex gap-1 rounded-md bg-zinc-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setSaleMode("therapy")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              saleMode === "therapy" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            Terapii
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
        <form action={packageAction} className="space-y-3">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="saleMode" value="package" />
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
          {methodAndAmount}
          {packageState?.message && <p className="text-sm text-red-600">{packageState.message}</p>}
          <Button type="submit" disabled={packagePending}>
            {packagePending ? "Se salvează…" : "Înregistrează plata pachetului"}
          </Button>
        </form>
      ) : (
        <>
          <div>
            <p className="text-xs font-medium text-zinc-700">Programările clientului</p>
            {bookings.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-400">Nicio programare încă.</p>
            ) : (
              <>
                <ul className="mt-1.5 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {visibleBookings.map((b) => {
                    const payable = isPayable(b);
                    const added = lines.some((l) => l.appointmentId === b.id);
                    return (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <label className={`flex items-center gap-2 ${payable ? "cursor-pointer" : "text-zinc-400"}`}>
                          <input
                            type="checkbox"
                            disabled={!payable}
                            checked={added}
                            onChange={() => toggleBooking(b)}
                            className="h-4 w-4 accent-[var(--mitmed-teal)]"
                            aria-label={`Adaugă la plată: ${b.therapyName}, ${formatSession(b.startsAt)}`}
                          />
                          <span className={b.status === "ANULATA" ? "line-through" : undefined}>
                            <span className="font-medium text-zinc-800">{b.therapyName}</span>
                            <span className="text-zinc-500"> · {formatSession(b.startsAt)}</span>
                          </span>
                        </label>
                        <BookingPaymentBadge booking={b} />
                      </li>
                    );
                  })}
                </ul>
                {sortedBookings.length > visibleBookings.length && (
                  <button
                    type="button"
                    onClick={() => setShowAllBookings(true)}
                    className="mt-1 text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
                  >
                    Arată toate cele {sortedBookings.length} programări
                  </button>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-700">Terapii de plătit</p>
            <div className="mt-1.5 space-y-2">
              {lines.map((line, i) => {
                const priced = preview?.lines[i];
                const booking = line.appointmentId ? bookingsById.get(line.appointmentId) : undefined;
                return (
                  <div key={line.key} className="rounded-lg border border-zinc-200 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={line.therapyId}
                        disabled={Boolean(booking)}
                        onChange={(e) =>
                          setLines((current) =>
                            current.map((l) => (l.key === line.key ? { ...l, therapyId: e.target.value } : l))
                          )
                        }
                        className="min-w-0 flex-1 sm:max-w-xs"
                        aria-label="Terapie"
                      >
                        {therapies.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} — {t.price} RON
                          </option>
                        ))}
                      </Select>
                      {booking && (
                        <span className="text-xs text-zinc-500">programarea din {formatSession(booking.startsAt)}</span>
                      )}
                      <span className="ml-auto text-sm tabular-nums">
                        {priced && Number(priced.discount_amount) > 0 && (
                          <span className="mr-1.5 text-xs text-zinc-400 line-through">{priced.base_price}</span>
                        )}
                        <strong>{priced ? `${priced.final_price} RON` : "…"}</strong>
                      </span>
                      <IconButton
                        icon={IconTrash}
                        label="Scoate terapia din plată"
                        variant="danger"
                        disabled={lines.length <= 1}
                        onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                      />
                    </div>
                    {priced?.fidelity_card_name && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Fidelitate: -{Number(priced.fidelity_discount_percent)}% ({priced.fidelity_card_name})
                      </p>
                    )}
                    {priced?.coupon_code && (
                      <p className="mt-1 text-xs font-medium text-sky-700">Cupon {priced.coupon_code}: -{priced.discount_amount} RON</p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => addLine(lines[lines.length - 1]?.therapyId ?? therapies[0]?.id ?? "")}
              className="mt-2 text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
            >
              + Adaugă terapie
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">Cupon</label>
            <Select value={couponMode} onChange={(e) => handleCouponModeChange(e.target.value)} className="mt-1.5 max-w-xs">
              <option value={NONE_OPTION}>Fără cupon</option>
              {availableCoupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.value}
                  {c.type === "PROCENT" ? "%" : " RON"}
                </option>
              ))}
              <option value={MANUAL_OPTION}>Alt cod (introdu manual)…</option>
            </Select>
            {couponMode === MANUAL_OPTION && (
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Cod cupon"
                className="mt-2 max-w-xs uppercase"
              />
            )}
            <p className="mt-1 text-xs text-zinc-400">
              Cuponul se aplică terapiilor pentru care e valabil; pe acelea nu se mai adaugă și reducerea de fidelitate.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            {previewError ? (
              <p className="text-red-600">{previewError}</p>
            ) : preview ? (
              <p className="text-zinc-700">
                {Number(preview.discount_amount) > 0 && (
                  <>
                    Preț de bază: {preview.base_price} RON · Reduceri: -{preview.discount_amount} RON ·{" "}
                  </>
                )}
                <strong className="text-zinc-900">Total: {preview.final_price} RON</strong>
                {previewing && <span className="ml-2 text-xs text-zinc-400">se recalculează…</span>}
              </p>
            ) : (
              <p className="text-zinc-400">Se calculează…</p>
            )}
          </div>

          {methodAndAmount}

          <Button type="button" onClick={submitTherapies} disabled={saving || lines.length === 0 || Boolean(previewError)}>
            {saving ? "Se salvează…" : lines.length > 1 ? `Înregistrează plata (${lines.length} terapii)` : "Înregistrează plata"}
          </Button>
        </>
      )}
    </div>
  );
}
