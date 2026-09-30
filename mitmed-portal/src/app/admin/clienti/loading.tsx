import { LoadingPage, FormCardSkeleton, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingPage className="space-y-8">
      <div>
        <Skeleton className="h-6 w-32" />
        <div className="mt-4">
          <TableSkeleton rows={8} cols={4} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <FormCardSkeleton fields={4} />
      </div>
    </LoadingPage>
  );
}
