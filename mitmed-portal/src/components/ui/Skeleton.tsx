/** Blocuri de schelet pentru fișierele `loading.tsx` — imită structura
 * paginilor reale (titlu, carduri, tabele), ca trecerea la conținut să nu
 * "sară". Pulsul e oprit pentru cine a cerut mișcare redusă. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-zinc-200/70 motion-safe:animate-pulse ${className}`} />;
}

/** Container accesibil: cititoarele de ecran anunță încărcarea o singură dată. */
export function LoadingPage({ children, className = "space-y-7" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Se încarcă…</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      {withSubtitle && <Skeleton className="h-4 w-full max-w-md" />}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden mm-card">
      <div className="flex gap-6 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-6 px-4 py-3.5">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "" : "max-w-32"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`mm-card space-y-3 p-4 ${className}`}>
      <Skeleton className="h-3 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Card cu un formular: etichete + câmpuri într-o grilă, plus butonul de salvare. */
export function FormCardSkeleton({ fields = 4, columns = "sm:grid-cols-2" }: { fields?: number; columns?: string }) {
  return (
    <div className="mm-card p-4">
      <Skeleton className="h-3 w-40" />
      <div className={`mt-4 grid gap-3 ${columns}`}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-9 w-32" />
    </div>
  );
}

export function StatTilesSkeleton({ count = 4, className = "sm:grid-cols-2 lg:grid-cols-4" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mm-card p-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-1.5 h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Listă de rânduri-card (cereri, documente, câmpuri de fișă). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mm-card flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Pagina de listă tipică din admin: titlu, tabel, apoi formularul de adăugare. */
export function AdminListPageSkeleton({ cols = 4, formFields = 4 }: { cols?: number; formFields?: number }) {
  return (
    <LoadingPage className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton cols={cols} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <FormCardSkeleton fields={formFields} />
      </div>
    </LoadingPage>
  );
}

/* ---- Portal client: aceleași clase de layout ca paginile reale ---- */

export function PortalHeaderSkeleton() {
  return (
    <header className="space-y-3">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-full max-w-lg" />
      <Skeleton className="h-4 w-full max-w-md" />
    </header>
  );
}

export function PortalPanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <section className="portal-feature-panel">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-10 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </section>
  );
}

export function PortalSubpageSkeleton({ panels = [3, 3] }: { panels?: number[] }) {
  return (
    <LoadingPage className="portal-subpage">
      <PortalHeaderSkeleton />
      {panels.map((lines, i) => (
        <PortalPanelSkeleton key={i} lines={lines} />
      ))}
    </LoadingPage>
  );
}
