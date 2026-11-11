import { CardSkeleton, LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Board: today's summary, today/tomorrow schedules next to the to-do list, then the week calendar. */
export default function Loading() {
  return (
    <LoadingPage className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]">
        <div className="mm-card space-y-2 p-5">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <CardSkeleton lines={4} />
      </div>
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
