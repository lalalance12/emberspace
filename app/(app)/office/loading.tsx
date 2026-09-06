import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function OfficeLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="6rem" />
      <Skeleton className="h-[28rem] w-full rounded-2xl" />
    </>
  );
}
