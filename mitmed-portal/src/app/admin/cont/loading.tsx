import { CardSkeleton, LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Account: the identity card, then password/devices next to role, preferences and shortcuts. */
export default function Loading() {
  return (
    <LoadingPage className="mx-auto max-w-5xl space-y-6">
      <div className="mm-card flex items-center gap-5 p-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </LoadingPage>
  );
}
