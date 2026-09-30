import { LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Fișa clientului: tab-urile și cardul de profil (tab-ul implicit). */
export default function Loading() {
  return (
    <LoadingPage className="space-y-8">
      <div className="flex gap-6 border-b border-zinc-200 px-4 pb-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      <section className="mm-card p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-4 w-28" />
        </div>
        <DetailGrid count={8} />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <Skeleton className="h-3 w-56" />
          <DetailGrid count={5} />
        </div>
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <Skeleton className="h-3 w-40" />
          <DetailGrid count={12} />
        </div>
      </section>
      <div className="mm-card space-y-3 p-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-20 w-full" />
      </div>
    </LoadingPage>
  );
}

function DetailGrid({ count }: { count: number }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
