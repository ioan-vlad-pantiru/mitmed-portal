import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Pagina nu a fost găsită</h1>
      <p className="max-w-md text-sm text-zinc-500">Linkul accesat nu (mai) există sau a fost mutat.</p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-[var(--mitmed-teal)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--mitmed-teal-deep)]"
      >
        Înapoi la pagina principală
      </Link>
    </div>
  );
}
