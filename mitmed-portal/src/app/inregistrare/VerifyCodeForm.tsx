"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { resendRegistrationCode, verifyRegistrationCode } from "@/actions/auth";

const RESEND_COOLDOWN_SECONDS = 30;

/** Pasul 2 al înregistrării — codul de 6 cifre primit pe WhatsApp. La succes,
 * backend-ul a creat deja contul (ACTIV) și a pornit sesiunea, deci trecem
 * direct în portal — niciun ecran de "așteaptă aprobarea". */
export function VerifyCodeForm({ phone }: { phone: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await verifyRegistrationCode(phone, code);
      if (result.ok) {
        router.push("/portal");
      } else {
        setError(result.message);
      }
    });
  }

  function resend() {
    setError(null);
    startTransition(async () => {
      const result = await resendRegistrationCode(phone);
      if (result.ok) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        const interval = setInterval(() => {
          setResendCooldown((s) => {
            if (s <= 1) {
              clearInterval(interval);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-[var(--mitmed-sky)]/12 px-3.5 py-3 text-sm text-[var(--mitmed-teal-deep)]">
        <MessageSquareText size={18} className="mt-0.5 shrink-0" />
        <p>
          Ți-am trimis un cod de 6 cifre pe WhatsApp la <strong>{phone}</strong>. Introdu-l mai jos — imediat ești în
          contul tău, gata de programare.
        </p>
      </div>

      <form
        action={submit}
        className="space-y-5"
      >
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
            Cod din WhatsApp
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-center text-lg tracking-[0.4em] text-[var(--mitmed-ink)] outline-none transition-colors focus:border-[var(--mitmed-sky)] focus:ring-2 focus:ring-[var(--mitmed-sky)]/40"
            placeholder="000000"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || code.length < 6}
          className="w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)] disabled:opacity-60"
        >
          {pending ? "Se verifică…" : "Confirmă și intră în cont"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-zinc-500">
        N-ai primit codul?{" "}
        {resendCooldown > 0 ? (
          <span className="text-zinc-400">Retrimite în {resendCooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={pending}
            className="font-medium text-[var(--mitmed-teal)] hover:underline disabled:opacity-60"
          >
            Retrimite codul
          </button>
        )}
      </div>
    </div>
  );
}
