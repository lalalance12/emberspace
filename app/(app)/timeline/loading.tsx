import { NoteGridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="8rem" />
      <Skeleton className="mb-8 h-48 w-full rounded-2xl" />
      <NoteGridSkeleton count={4} />
    </>
  );
}
