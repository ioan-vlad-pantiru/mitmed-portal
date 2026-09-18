"use client";

import { useEffect } from "react";

// Prins doar când eroarea vine chiar din layout-ul rădăcină (foarte rar) —
// de-asta trebuie să-și redeseneze singur <html>/<body>, spre deosebire de
// error.tsx, care se montează în interiorul layout-ului existent.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ro">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center font-sans">
          <h1 className="text-lg font-semibold text-zinc-900">A apărut o eroare neașteptată</h1>
          <p className="max-w-md text-sm text-zinc-500">
            Ne pare rău, portalul nu a putut porni corect. Reîncarcă pagina sau revino mai târziu.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-md bg-[#005f60] px-4 py-2 text-sm font-semibold text-white"
          >
            Încearcă din nou
          </button>
        </div>
      </body>
    </html>
  );
}
