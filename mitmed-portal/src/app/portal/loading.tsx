import { LoadingPage, Skeleton } from "@/components/ui/Skeleton";

/** Portal home: greeting, the next-visit card and the to-do list. */
export default function Loading() {
  return (
    <LoadingPage className="portal-home">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-56 w-full rounded-[var(--mm-radius-xl)]" />
      <div className="space-y-2.5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-[4.25rem] w-full rounded-[var(--mm-radius-lg)]" />
        <Skeleton className="h-[4.25rem] w-full rounded-[var(--mm-radius-lg)]" />
      </div>
    </LoadingPage>
  );
}
