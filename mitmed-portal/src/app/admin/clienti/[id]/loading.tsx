import { CardSkeleton, LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Client file: the header card (name, alerts, actions), the tabs, then the tab content. */
export default function Loading() {
  return (
    <LoadingPage className="space-y-6">
      <div className="mm-card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-zinc-200 pb-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-24" />
        ))}
      </div>
      <CardSkeleton lines={5} />
      <CardSkeleton lines={3} />
    </LoadingPage>
  );
}
