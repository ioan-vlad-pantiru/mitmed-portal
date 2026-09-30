import { LoadingPage, PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mm-card p-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="mt-4 h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-4 h-4 w-24" />
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}
