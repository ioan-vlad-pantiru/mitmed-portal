import { LoadingPage, FormCardSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />
      <div className="max-w-md">
        <FormCardSkeleton fields={3} columns="" />
      </div>
    </LoadingPage>
  );
}
