"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Câmp de parolă cu buton de arătat/ascuns — pentru formularele de
 * autentificare/înregistrare, stilizate direct (nu prin Input.tsx/mm-input,
 * care e sistemul folosit în admin). Controlat doar dacă i se dă `value` —
 * altfel rămâne necontrolat, ca parola de la /inregistrare (nu se păstrează
 * intenționat după o eroare, vezi comentariul din acea pagină). */
export function AuthPasswordField({
  id,
  name,
  label,
  required = true,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 pr-11 text-sm text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ascunde parola" : "Arată parola"}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
