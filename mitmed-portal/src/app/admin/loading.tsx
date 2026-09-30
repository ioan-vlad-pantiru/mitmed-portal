import { LoadingPage, PageHeaderSkeleton, Skeleton, StatTilesSkeleton } from "@/components/ui/Skeleton";

/** Bordul: programările de azi, indicatorii și calendarul săptămânii. */
export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <div className="mm-card space-y-3 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <StatTilesSkeleton />
      <div className="mm-card p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
        <Skeleton className="mt-3 h-[26rem] w-full" />
      </div>
    </LoadingPage>
  );
}
