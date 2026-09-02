// Paletă categorică validată (vezi skill-ul dataviz — ordine fixă, verificată
// cu scripts/validate_palette.js pentru separare CVD/contrast). "Altele" nu
// consumă un slot din paletă — e un bucket agregat, colorat neutru.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const OTHER_COLOR = "#a1a1aa"; // zinc-400

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 72;
const STROKE = 26;
const GAP = 4; // px de-a lungul circumferinței, între segmente
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type DonutSlice = { label: string; value: number };

/** Grafic circular (donut) part-to-whole — max. 6 segmente (top 5 + "Altele"),
 * cu numărul total în centru. Complementar listei cu bare de mai jos, care
 * rămâne forma corectă pentru compararea precisă a valorilor apropiate. */
export function RevenueDonut({
  slices,
  total,
  totalLabel,
  formatValue,
}: {
  slices: DonutSlice[];
  total: number;
  totalLabel: string;
  formatValue: (v: number) => string;
}) {
  if (total <= 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">Niciun venit încă.</p>;
  }

  // Fiecare arc știe cât "a mers roata" înaintea lui însumând fracțiile
  // segmentelor anterioare — pur funcțional, fără variabilă mutată în timpul
  // randării (slices e cel mult 6 elemente, costul O(n²) e nesemnificativ).
  const arcs = slices.map((s, i) => {
    const cumulative = slices.slice(0, i).reduce((sum, prev) => sum + (prev.value / total) * CIRCUMFERENCE, 0);
    const fraction = s.value / total;
    const segmentLen = fraction * CIRCUMFERENCE;
    const visibleLen = Math.max(0, segmentLen - GAP);
    return {
      ...s,
      color: i < SERIES_COLORS.length ? SERIES_COLORS[i] : OTHER_COLOR,
      dasharray: `${visibleLen} ${CIRCUMFERENCE - visibleLen}`,
      dashoffset: -cumulative,
      pct: fraction * 100,
    };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label={`${totalLabel}: ${formatValue(total)}, distribuit pe terapii`}
      >
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#f4f4f5" strokeWidth={STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
            >
              <title>
                {a.label}: {formatValue(a.value)} ({a.pct.toFixed(0)}%)
              </title>
            </circle>
          ))}
        </g>
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          className="fill-zinc-900 font-sans text-[17px] font-bold"
        >
          {formatValue(total)}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-zinc-400 font-sans text-[10px]">
          {totalLabel}
        </text>
      </svg>

      {/* Legendă cu etichete vizibile — segmentele deschise (verde/galben/roz)
          nu ating 3:1 de contrast pe fondul alb, deci identitatea nu se
          bazează doar pe culoare (vezi skill-ul dataviz, regula de "relief"). */}
      <ul className="grid w-full grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {arcs.map((a) => (
          <li key={a.label} className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            <span className="truncate text-zinc-700">{a.label}</span>
            <span className="mm-numeric ml-auto shrink-0 text-zinc-400">{a.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
