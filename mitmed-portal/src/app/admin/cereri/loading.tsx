import { ListSkeleton, LoadingPage, PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Cererile în așteptare, apoi cele deja procesate. */
export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <ListSkeleton rows={3} />
      </div>
      <div className="space-y-3 opacity-60">
        <Skeleton className="h-5 w-32" />
        <ListSkeleton rows={2} />
      </div>
    </LoadingPage>
  );
}
