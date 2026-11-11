import { LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Client list: title, search with filters, then rows. */
export default function Loading() {
  return (
    <LoadingPage className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="mm-card space-y-3 p-4">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mm-card divide-y divide-zinc-100">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}
