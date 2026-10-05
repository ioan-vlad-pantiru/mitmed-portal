import type { FidelityTherapyProgress } from "@/actions/fidelity";

// Peste atâtea ședințe într-un ciclu, cerculețele devin prea mici — trecem
// pe o bară continuă cu marcaje la trepte.
const MAX_STAMPS_AS_DOTS = 12;

function nextRewardLabel(progress: FidelityTherapyProgress, audience: "admin" | "client"): string | null {
  const reward = progress.next_reward;
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

/** Progresul unui card pe o terapie: ședințele plătite din ciclul curent
 * (ștampile) și unde cad treptele de reducere. */
export function FidelityTherapyProgressView({
  progress,
  audience = "admin",
}: {
  progress: FidelityTherapyProgress;
  audience?: "admin" | "client";
}) {
  const { stamps, cycle_length: cycle } = progress;
  const discountAt = new Map(progress.tiers.map((t) => [t.session_number, Number(t.discount_percent)]));
  const label = nextRewardLabel(progress, audience);
  const rewardIsNext = progress.next_reward?.sessions_left === 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-800">{progress.therapy_name}</p>
        <p className="text-xs tabular-nums text-zinc-500">
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
          {progress.tiers.map((t) => (
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
      {audience === "admin" && progress.discounted_sessions_used > 0 && (
        <p className="text-xs text-zinc-400">{progress.discounted_sessions_used} reduceri acordate până acum</p>
      )}
    </div>
  );
}
