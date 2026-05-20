import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton({ rows = 3, cols }: { rows?: number; cols: string[] }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
      <div className="border-b border-black/10 dark:border-white/10 bg-muted/40 flex items-center gap-3 px-2 py-1.5">
        {cols.map((w, i) => (
          <Skeleton key={i} className={`h-2.5 ${w}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-black/10 dark:border-white/10 last:border-0 flex items-center gap-3 px-2 py-2"
        >
          {cols.map((w, j) => (
            <Skeleton key={j} className={`h-3.5 ${w}`} />
          ))}
        </div>
      ))}
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
      </div>

      {/* Project header card */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>

      {/* Takeoffs section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <TableSkeleton rows={3} cols={["w-36", "w-20", "w-16", "w-6"]} />
      </div>

      {/* Price Requests section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
      </div>

      {/* Estimates section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
        <TableSkeleton
          rows={3}
          cols={["w-40", "w-16", "w-16", "w-20", "w-10", "w-16", "w-6"]}
        />
      </div>
    </div>
  );
}
