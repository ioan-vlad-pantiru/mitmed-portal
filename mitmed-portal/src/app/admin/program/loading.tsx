import { LoadingPage, PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Programul pe zile ale săptămânii și concediile. */
export default function Loading() {
  return (
    <LoadingPage className="space-y-6">
      <PageHeaderSkeleton />
      <div className="mm-card space-y-3 p-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mm-card space-y-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </LoadingPage>
  );
}
