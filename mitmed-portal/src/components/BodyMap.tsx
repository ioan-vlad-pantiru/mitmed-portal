"use client";

import { useState } from "react";

export type BodyMapPoint = { x: number; y: number; label?: string };

// Siluetă umană minimală, față — suficientă ca reper vizual pentru a marca
// zona tratată/dureroasă. x/y din puncte sunt fracții (0-1) din cutia 0..100.
function Silhouette() {
  return (
    <svg viewBox="0 0 100 200" className="h-full w-full">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-300">
        <circle cx="50" cy="18" r="14" />
        <path d="M50 32 L50 100" />
        <path d="M50 40 L20 45 L15 90" />
        <path d="M50 40 L80 45 L85 90" />
        <path d="M35 100 L50 100 L65 100" />
        <path d="M50 100 L35 140 L30 195" />
        <path d="M50 100 L65 140 L70 195" />
      </g>
    </svg>
  );
}

/** Read-only — afișează punctele deja salvate (folosit în admin/portal). */
export function BodyMapView({ points }: { points: BodyMapPoint[] }) {
  if (!points || points.length === 0) return null;
  return (
    <div className="relative mx-auto h-40 w-20">
      <Silhouette />
      {points.map((p, i) => (
        <span
          key={i}
          title={p.label}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--mitmed-orange)] shadow"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Interactiv — click pe siluetă adaugă un punct; folosit în formularul de notițe. */
export function BodyMapPicker({
  value,
  onChange,
}: {
  value: BodyMapPoint[];
  onChange: (points: BodyMapPoint[]) => void;
}) {
  const [pendingLabel, setPendingLabel] = useState("");

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onChange([...value, { x, y, label: pendingLabel || undefined }]);
    setPendingLabel("");
  }

  function removePoint(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex items-start gap-4">
      <div
        onClick={handleClick}
        className="relative h-40 w-20 shrink-0 cursor-crosshair rounded-md bg-zinc-50"
      >
        <Silhouette />
        {value.map((p, i) => (
          <button
            key={i}
            type="button"
            title={`${p.label ?? "punct"} — click pt. a șterge`}
            onClick={(e) => {
              e.stopPropagation();
              removePoint(i);
            }}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--mitmed-orange)] shadow"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}
      </div>
      <div className="flex-1 text-xs text-zinc-500">
        <p>Click pe siluetă pentru a marca o zonă. Click pe un punct pentru a-l șterge.</p>
        <input
          value={pendingLabel}
          onChange={(e) => setPendingLabel(e.target.value)}
          placeholder="Etichetă pt. următorul punct (opțional)"
          className="mt-1.5 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
