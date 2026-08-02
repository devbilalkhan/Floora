import { Skeleton } from "@/components/ui/skeleton";

function GroupTableCard({ rows }: { rows: number }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/20 border-b border-black/10 dark:border-white/10">
        <Skeleton className="h-3.5 w-3.5" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-20 ml-auto" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      {/* Line item table */}
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/10">
        {["w-14", "w-16", "w-20", "flex-1", "w-10", "w-14", "w-14"].map((w, i) => (
          <Skeleton key={i} className={`h-2.5 ${w}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-black/5 dark:border-white/5">
          {["w-14", "w-16", "w-20", "flex-1", "w-10", "w-14", "w-14"].map((w, j) => (
            <Skeleton key={j} className={`h-3 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ActualsSectionSkeleton({ groups }: { groups: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-32" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: groups }).map((_, i) => (
          <GroupTableCard key={i} rows={i === 0 ? 3 : 2} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-56" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* P&L summary cards */}
      <div className="flex flex-wrap gap-2">
        {["w-[130px]", "w-[130px]", "w-[130px]", "w-[130px]", "w-[150px]"].map((w, i) => (
          <div key={i} className={`flex-1 min-w-[130px] ${w} rounded-md border border-border bg-muted/20 px-3 py-2.5 space-y-1.5`}>
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3 space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-[160px] w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Income section */}
      <ActualsSectionSkeleton groups={2} />

      {/* Expense section */}
      <ActualsSectionSkeleton groups={2} />
    </div>
  );
}
