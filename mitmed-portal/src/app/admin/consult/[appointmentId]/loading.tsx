import { LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Ecranul de consult: bara de sus și cele două coloane (context + formular). */
export default function Loading() {
  return (
    <LoadingPage className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6 sm:h-screen">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 bg-white px-4 py-3 sm:px-6">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 sm:grid-cols-[300px_1fr] sm:gap-6 sm:p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="mm-card space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
        <div className="mm-card space-y-4 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </LoadingPage>
  );
}
