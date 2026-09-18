import Link from "next/link";
import { Logo } from "@/components/Logo";

function RecoveryWave() {
  return (
    <svg
      viewBox="0 0 300 64"
      fill="none"
      className="w-full max-w-[280px]"
      aria-hidden="true"
    >
      <path
        className="mitmed-pulse-track"
        d="M0,32 C30,8 45,56 75,32 C105,8 120,56 150,32 C180,8 195,56 225,32 C255,8 270,56 300,32"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="mitmed-pulse-comet"
        d="M0,32 C30,8 45,56 75,32 C105,8 120,56 150,32 C180,8 195,56 225,32 C255,8 270,56 300,32"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AuthShell({
  heading,
  subheading,
  children,
  footer,
}: {
  heading: string;
  subheading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-stretch justify-center bg-[var(--mitmed-paper)] p-4 sm:p-6">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_60px_-24px_rgba(0,63,64,0.35)] flex-col sm:flex-row">
        {/* Panou de brand */}
        <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[var(--mitmed-teal)] to-[var(--mitmed-teal-deep)] px-8 py-8 sm:w-[42%] sm:px-10 sm:py-10">
          <div>
            <Logo size={40} />
            <span className="mt-3 block text-xl font-bold tracking-tight text-[var(--mitmed-mist)]">MitMed</span>
            <p className="mt-1 font-[family-name:var(--font-editorial)] text-lg italic text-[var(--mitmed-sky)]">
              Puterea vindecării
            </p>
          </div>

          <div className="mt-10 sm:mt-0">
            <RecoveryWave />
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--mitmed-mist)_55%,transparent)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--mitmed-orange)]" />
              Recuperare, pas cu pas
            </p>
          </div>
        </div>

        {/* Panou de formular */}
        <div className="flex-1 bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mitmed-ink)]">{heading}</h1>
          <p className="mt-1 text-sm text-zinc-500">{subheading}</p>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>}

          <p className="mt-6 text-center text-xs text-zinc-400">
            <Link href="/confidentialitate" className="hover:underline">
              Confidențialitate
            </Link>{" "}
            ·{" "}
            <Link href="/termeni" className="hover:underline">
              Termeni
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
