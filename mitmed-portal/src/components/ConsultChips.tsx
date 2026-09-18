// Chip-uri de completare rapidă pentru fișa de consult — reduc câtă text trebuie
// tastat manual în timpul ședinței. Fiecare chip toggle-uiește o linie "• ..."
// în textul câmpului țintă, deci rămân compatibile cu câmpurile text simple
// trimise la backend (nu introduc o structură de date nouă).

function toggleLine(text: string, label: string): string {
  const marker = `• ${label}`;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const idx = lines.findIndex((l) => l.trim() === marker);
  if (idx >= 0) {
    lines.splice(idx, 1);
    return lines.join("\n");
  }
  lines.push(marker);
  return lines.join("\n");
}

function hasLine(text: string, label: string): boolean {
  const marker = `• ${label}`;
  return text.split("\n").some((l) => l.trim() === marker);
}

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((label) => {
        const active = hasLine(value, label);
        return (
          <button
            key={label}
            type="button"
            className="mm-chip"
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(toggleLine(value, label))}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const PAIN_LINE_RE = /^• Durere: (\d{1,2})\/10$/;

function getPainValue(text: string): number | null {
  for (const line of text.split("\n")) {
    const m = line.trim().match(PAIN_LINE_RE);
    if (m) return Number(m[1]);
  }
  return null;
}

function setPainValue(text: string, n: number): string {
  const marker = `• Durere: ${n}/10`;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const idx = lines.findIndex((l) => PAIN_LINE_RE.test(l.trim()));
  if (idx >= 0) {
    if (lines[idx].trim() === marker) {
      lines.splice(idx, 1);
      return lines.join("\n");
    }
    lines[idx] = marker;
    return lines.join("\n");
  }
  lines.push(marker);
  return lines.join("\n");
}

export function PainScalePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const current = getPainValue(value);
  return (
    <div className="mt-2">
      <p className="text-xs text-zinc-500">Scor durere (EVA)</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {Array.from({ length: 11 }, (_, n) => n).map((n) => (
          <button
            key={n}
            type="button"
            className="mm-chip mm-numeric min-w-8 justify-center"
            data-active={current === n}
            aria-pressed={current === n}
            onClick={() => onChange(setPainValue(value, n))}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
