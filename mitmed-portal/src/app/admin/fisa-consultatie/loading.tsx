import { LoadingPage, FormCardSkeleton, ListSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingPage className="space-y-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <FormCardSkeleton fields={3} />
      </div>
    </LoadingPage>
  );
}
