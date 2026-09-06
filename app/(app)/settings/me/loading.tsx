import { FieldSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsMeLoading() {
  return <><PageHeaderSkeleton titleWidth="12rem" /><div className="settings-tabs"><Skeleton className="h-8 w-40" /></div>
    <div className="settings-content settings-stack" role="status" aria-label="Loading your settings">
      {[0,1,2].map(i => <div key={i} className="settings-section"><div className="flex flex-col gap-4"><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-40 max-w-full" /></div><div className="settings-fields"><FieldSkeleton /><FieldSkeleton /></div></div>)}
    </div></>;
}
