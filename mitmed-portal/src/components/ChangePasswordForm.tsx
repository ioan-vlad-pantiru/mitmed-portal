"use client";

import { useActionState, useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { changePassword } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const MIN_LENGTH = 8;

/** Change password with show/hide and a live checklist, so nobody submits a
 * password that will be rejected. Used by staff and by clients. */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const [visible, setVisible] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // After a successful save, start from empty fields again (React's
  // "adjust state when a value changes" pattern; no effect needed).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) {
      setNext("");
      setConfirm("");
    }
  }
  const longEnough = next.length >= MIN_LENGTH;
  const matches = next.length > 0 && next === confirm;
  const type = visible ? "text" : "password";

  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Parola curentă">
        <Input name="currentPassword" type={type} autoComplete="current-password" required className="mt-1" />
      </Field>
      <Field label="Parola nouă">
        <Input
          name="newPassword"
          type={type}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="mt-1"
        />
      </Field>
      <Field label="Scrie din nou parola nouă">
        <Input
          name="confirmPassword"
          type={type}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1"
        />
      </Field>

      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--mitmed-teal)] hover:underline"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />} {visible ? "Ascunde parolele" : "Arată parolele"}
      </button>

      <ul className="space-y-1 text-sm" aria-live="polite">
        <Rule ok={longEnough}>Cel puțin {MIN_LENGTH} caractere</Rule>
        <Rule ok={matches}>Cele două parole noi sunt la fel</Rule>
      </ul>

      {state?.message && (
        <p role="alert" data-variant={state.success ? "success" : "danger"} className="mm-alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || !longEnough || !matches}>
        {pending ? "Se salvează…" : "Schimbă parola"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      {children}
    </label>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-[var(--mm-success)]" : "text-zinc-500"}`}>
      {ok ? <Check size={15} strokeWidth={2.5} /> : <Circle size={13} />}
      {children}
    </li>
  );
}
