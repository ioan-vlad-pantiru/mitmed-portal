import { CardSkeleton, LoadingPage, PageHeaderSkeleton, Skeleton, StatTilesSkeleton } from "@/components/ui/Skeleton";

/** Indicatorii, graficul de încasări și distribuțiile despre clienți. */
export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <StatTilesSkeleton className="sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
        <div className="mm-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="mm-card grid place-items-center p-5">
          <Skeleton className="h-44 w-44 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      </div>
    </LoadingPage>
  );
}
