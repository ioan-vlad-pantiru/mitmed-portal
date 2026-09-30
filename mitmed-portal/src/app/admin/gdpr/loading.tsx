import { ListSkeleton, LoadingPage, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <ListSkeleton rows={3} />
    </LoadingPage>
  );
}
