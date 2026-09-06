import { FieldSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsTeamLoading() {
  return <><PageHeaderSkeleton titleWidth="12rem" /><div className="settings-tabs"><Skeleton className="h-8 w-40" /></div>
    <div className="settings-content settings-stack" role="status" aria-label="Loading team settings">
      <div className="settings-team-summary"><div className="flex items-center gap-4"><Skeleton className="size-12" /><Skeleton className="h-6 w-36" /></div></div>
      <div className="settings-invite"><div className="flex flex-col gap-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-3 w-56 max-w-full" /></div><Skeleton className="h-12 w-44" /></div>
      <div className="settings-section"><Skeleton className="h-6 w-32" /><div className="settings-fields"><FieldSkeleton /><FieldSkeleton /></div></div>
    </div></>;
}
