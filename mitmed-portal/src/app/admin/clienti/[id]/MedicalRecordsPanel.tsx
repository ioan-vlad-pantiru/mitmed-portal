"use client";

import { useState } from "react";
import { Activity, ChevronRight, ClipboardCheck, Home, MapPin, MessageSquareText, Ruler } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { BodyMapView } from "@/components/BodyMap";

type MedicalRecord = {
  id: string;
  session_date: string;
  diagnosis: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  notes: string;
  treatment_plan: string | null;
  body_map: { x: number; y: number; label?: string }[] | null;
  therapy: { name: string } | null;
  author: { email: string } | null;
};

// Fișa de consult completă e mult conținut (S/O/A + intervenții + plan + hartă
// corporală) — nu intră util pe o linie de listă. Overview-ul arată doar
// esențialul (dată, diagnostic/terapie, autor); click deschide totul în modal.
export function MedicalRecordsPanel({ records }: { records: MedicalRecord[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = records.find((r) => r.id === openId) ?? null;

  if (records.length === 0) {
    return <p className="text-sm text-zinc-400">Nicio intrare încă.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {records.map((r) => {
          const date = new Date(r.session_date);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              className="mm-card flex w-full items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 hover:border-[var(--mitmed-sky)]/40"
            >
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--mm-info-bg)] text-[var(--mitmed-teal-deep)]">
                <span className="mm-numeric text-[10px] font-semibold uppercase leading-none">
                  {date.toLocaleDateString("ro-RO", { month: "short" }).replace(".", "")}
                </span>
                <span className="mm-numeric text-base font-bold leading-none">{date.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {r.diagnosis || r.therapy?.name || "Ședință"}
                  </p>
                  {r.body_map && r.body_map.length > 0 && (
                    <MapPin size={13} className="shrink-0 text-zinc-400" aria-label="Hartă corporală atașată" />
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {r.therapy?.name ?? "—"} · {r.author?.email ?? "—"}
                </p>
              </div>
              <span className="mm-numeric shrink-0 text-xs text-zinc-400">
                {date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <ChevronRight size={16} className="shrink-0 text-zinc-300" />
            </button>
          );
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
        title={selected?.diagnosis || selected?.therapy?.name || "Ședință"}
        description={
          selected
            ? `${new Date(selected.session_date).toLocaleString("ro-RO")} · ${selected.therapy?.name ?? "—"} · scris de ${selected.author?.email ?? "—"}`
            : undefined
        }
        size="lg"
      >
        {selected && (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <SoapField icon={MessageSquareText} label="S · Relatarea clientului" value={selected.subjective} accent="sky" />
            <SoapField icon={Ruler} label="O · Observații și măsurători" value={selected.objective} accent="teal" />
            <SoapField icon={Activity} label="A · Evaluare clinică" value={selected.assessment} accent="teal" />
            <SoapField icon={ClipboardCheck} label="Intervenții efectuate și răspuns" value={selected.notes} accent="teal" />
            <SoapField icon={Home} label="P · Plan următoare" value={selected.treatment_plan} accent="highlight" />
            {selected.body_map && selected.body_map.length > 0 && (
              <div className="rounded-lg border border-zinc-100 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hartă corporală</p>
                <div className="mt-2 rounded-lg bg-zinc-50 p-2">
                  <BodyMapView points={selected.body_map} />
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

const ACCENT_STYLES = {
  sky: { card: "border-sky-100 bg-sky-50/40", badge: "bg-sky-100 text-sky-700", label: "text-sky-800" },
  teal: { card: "border-zinc-100 bg-white", badge: "bg-[var(--mm-info-bg)] text-[var(--mitmed-teal)]", label: "text-zinc-500" },
  highlight: {
    card: "border-[var(--mitmed-teal)]/25 bg-[var(--mm-info-bg)]",
    badge: "bg-white text-[var(--mitmed-teal)]",
    label: "text-[var(--mitmed-teal-deep)]",
  },
} as const;

// Chip-urile din consult scriu linii "• Text" — le despărțim în puncte
// distincte în loc să le afișăm ca un singur bloc de text cu caractere "•"
// amestecate cu text liber.
function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim().replace(/^•\s*/, ""))
    .filter(Boolean);
}

// Randează o secțiune SOAP doar dacă a fost completată — înregistrările mai
// vechi (dinainte de câmpurile S/O/A) nu au aceste valori.
function SoapField({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | null;
  accent: keyof typeof ACCENT_STYLES;
}) {
  if (!value) return null;
  const style = ACCENT_STYLES[accent];
  const lines = parseLines(value);
  return (
    <div className={`rounded-lg border p-3 ${style.card}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${style.badge}`}>
          <Icon size={14} />
        </span>
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${style.label}`}>{label}</h3>
      </div>
      <ul className="mt-2 space-y-1 pl-9 text-sm text-zinc-700">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
