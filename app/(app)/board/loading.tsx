import { NoteGridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="6rem" />
      <Skeleton className="mb-8 h-28 w-full rounded-2xl" />
      <div className="mb-6 flex justify-between gap-6"><Skeleton className="h-10 w-40 rounded-lg" /><Skeleton className="h-10 w-72 rounded-lg" /></div>
      <NoteGridSkeleton count={6} />
    </>
  );
}
