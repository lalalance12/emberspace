import { FieldSkeleton, NoteSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function MeLoading() {
  return <><PageHeaderSkeleton titleWidth="20rem" /><div className="status-workspace" role="status" aria-label="Loading your status">
    <div className="status-editor"><div className="status-section status-fields">
      <Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-52 max-w-full" />
      <div className="status-state-grid">{Array.from({length:8}, (_,i) => <Skeleton key={i} className="h-12" />)}</div>
      <FieldSkeleton /><FieldSkeleton inputClass="h-28" /><FieldSkeleton />
    </div><div className="status-section"><div className="status-timing-grid"><FieldSkeleton /><FieldSkeleton /></div></div></div>
    <aside className="flex flex-col gap-5"><Skeleton className="h-4 w-28" /><NoteSkeleton /></aside>
  </div></>;
}
