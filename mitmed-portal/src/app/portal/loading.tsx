import { LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Acasă în portal: salutul, următoarea programare și scurtăturile. */
export default function Loading() {
  return (
    <LoadingPage className="portal-page portal-home">
      <div className="portal-intro space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="portal-dashboard">
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </LoadingPage>
  );
}
