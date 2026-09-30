import { LoadingPage, FormCardSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Șabloanele de declarații: câte un card cu titlu și textul lung. */
export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mm-card space-y-3 p-4">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
      <FormCardSkeleton fields={2} />
    </LoadingPage>
  );
}
