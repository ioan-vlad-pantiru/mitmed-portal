import { Check } from "lucide-react";
import type { ClientFidelityCard } from "@/actions/fidelity";

// Peste atâtea ședințe într-un ciclu, cerculețele devin prea mici — trecem
// pe o bară continuă cu marcaje la trepte.
const MAX_STAMPS_AS_DOTS = 12;

/** One sentence about the next discount, e.g. "Încă 2 ședințe până la -25%". */
export function nextRewardLabel(card: ClientFidelityCard, audience: "admin" | "client"): string | null {
  const reward = card.next_reward;
  if (!reward) return null;
  const percent = Number(reward.discount_percent);
  if (reward.sessions_left === 0) {
    return audience === "client"
      ? `Următoarea ședință are -${percent}%!`
      : `Următoarea ședință plătită are -${percent}%`;
  }
  const sessions = reward.sessions_left === 1 ? "încă o ședință" : `încă ${reward.sessions_left} ședințe`;
  return `${sessions.charAt(0).toUpperCase()}${sessions.slice(1)} până la -${percent}%`;
}

/** Progresul unui card: ședințele plătite din ciclul curent (din oricare
 * terapie a cardului — același contor), unde cad treptele de reducere și din
 * ce terapii provin ședințele de până acum. */
export function FidelityCardProgress({
  card,
  audience = "admin",
}: {
  card: ClientFidelityCard;
  audience?: "admin" | "client";
}) {
  if (audience === "client") return <ClientStampCard card={card} />;
  const { stamps, cycle_length: cycle } = card;
  const discountAt = new Map(card.tiers.map((t) => [t.session_number, Number(t.discount_percent)]));
  const label = nextRewardLabel(card, audience);
  const rewardIsNext = card.next_reward?.sessions_left === 0;
  const breakdown = card.cycle_breakdown.map((b) => `${b.sessions} ${b.therapy_name}`).join(", ");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-zinc-500">{card.therapies.map((t) => t.therapy_name).join(" · ")}</p>
        <p className="shrink-0 text-xs tabular-nums text-zinc-500">
          {stamps} / {cycle} ședințe
        </p>
      </div>

      {cycle <= MAX_STAMPS_AS_DOTS ? (
        <ol className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`${stamps} din ${cycle} ședințe plătite`}>
          {Array.from({ length: cycle }, (_, i) => {
            const session = i + 1;
            const filled = session <= stamps;
            const discount = discountAt.get(session);
            const isNext = session === stamps + 1;
            return (
              <li key={session} className="flex w-9 flex-col items-center gap-0.5">
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
                    filled
                      ? "border-[var(--mitmed-teal)] bg-[var(--mitmed-teal)] text-white"
                      : discount
                        ? "border-emerald-500 border-dashed bg-emerald-50 text-emerald-700"
                        : "border-zinc-300 bg-white text-zinc-400",
                    isNext ? "ring-2 ring-offset-1 ring-[var(--mitmed-teal)]/40" : "",
                  ].join(" ")}
                >
                  {session}
                </span>
                <span className={`text-[10px] leading-none ${discount ? "font-semibold text-emerald-700" : "text-transparent"}`}>
                  {discount ? `-${discount}%` : "·"}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="relative mt-2 mb-4 h-2 rounded-full bg-zinc-100">
          <div
            className="h-2 rounded-full bg-[var(--mitmed-teal)]"
            style={{ width: `${Math.min(100, (stamps / cycle) * 100)}%` }}
          />
          {card.tiers.map((t) => (
            <span
              key={t.session_number}
              className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-emerald-700"
              style={{ left: `${(t.session_number / cycle) * 100}%` }}
            >
              {t.session_number}: -{Number(t.discount_percent)}%
            </span>
          ))}
        </div>
      )}

      {label && (
        <p className={`mt-1 text-xs ${rewardIsNext ? "font-medium text-emerald-700" : "text-zinc-500"}`}>{label}</p>
      )}
      {breakdown && <p className="text-xs text-zinc-400">Ciclul curent: {breakdown}</p>}
      {audience === "admin" && card.discounted_sessions_used > 0 && (
        <p className="text-xs text-zinc-400">{card.discounted_sessions_used} reduceri acordate până acum</p>
      )}
    </div>
  );
}

/** The client's view of a card: how far along they are, which visits earn a
 * discount and what happens next — without the staff-only details. */
function ClientStampCard({ card }: { card: ClientFidelityCard }) {
  const { stamps, cycle_length: cycle } = card;
  const discountAt = new Map(card.tiers.map((t) => [t.session_number, Number(t.discount_percent)]));
  const label = nextRewardLabel(card, "client");
  const rewardIsNext = card.next_reward?.sessions_left === 0;
  const asDots = cycle <= MAX_STAMPS_AS_DOTS;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          <span className="text-lg font-bold tabular-nums text-[var(--mitmed-teal-deep)]">{stamps}</span> din{" "}
          <span className="tabular-nums">{cycle}</span> ședințe
        </p>
        {label && (
          <p
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              rewardIsNext ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {label}
          </p>
        )}
      </div>

      {asDots ? (
        <ol className="mt-3 flex flex-wrap gap-3" aria-label={`${stamps} din ${cycle} ședințe`}>
          {Array.from({ length: cycle }, (_, i) => {
            const session = i + 1;
            const filled = session <= stamps;
            const discount = discountAt.get(session);
            const isNext = session === stamps + 1;
            return (
              <li key={session} className="flex flex-col items-center gap-1">
                <span
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums",
                    filled
                      ? "border-[var(--mitmed-teal)] bg-[var(--mitmed-teal)] text-white"
                      : discount
                        ? "border-dashed border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-white text-zinc-400",
                    isNext ? "ring-2 ring-[var(--mitmed-sky)] ring-offset-2" : "",
                  ].join(" ")}
                  title={filled ? `Ședința ${session}: făcută` : discount ? `Ședința ${session}: -${discount}%` : `Ședința ${session}`}
                >
                  {filled ? <Check className="h-5 w-5" strokeWidth={3} /> : discount ? `-${discount}%` : session}
                </span>
                <span className="text-[10px] font-medium leading-none text-zinc-400">{isNext ? "urm." : session}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-[var(--mitmed-teal)]" style={{ width: `${Math.min(100, (stamps / cycle) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Reduceri la ședințele:{" "}
            {card.tiers.map((t) => `${t.session_number} (-${Number(t.discount_percent)}%)`).join(", ")}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Fiecare vizită plătită pentru una din terapiile cardului adaugă o ștampilă. După ședința {cycle}, cardul o ia de la
        capăt.
      </p>
    </div>
  );
}
