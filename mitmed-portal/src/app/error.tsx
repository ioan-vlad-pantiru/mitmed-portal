"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Fără un serviciu de monitorizare configurat (Sentry etc.), consola e
    // singurul loc unde ajunge eroarea din client.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">A apărut o eroare neașteptată</h1>
      <p className="max-w-md text-sm text-zinc-500">
        Ne pare rău, ceva nu a funcționat cum trebuia. Poți încerca din nou sau reveni mai târziu. Dacă problema
        persistă, contactează recepția.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-md bg-[var(--mitmed-teal)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--mitmed-teal-deep)]"
      >
        Încearcă din nou
      </button>
    </div>
  );
}
