import { Skeleton } from "@/components/ui/skeleton";

function TableCard({ rows, cols }: { rows: number; cols: string[] }) {
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
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
        </div>
      </div>

      {/* Estimates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
        <TableCard rows={3} cols={["w-40", "w-16", "w-16", "w-20", "w-10", "w-16", "w-6"]} />
      </div>

      {/* Quotes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <TableCard rows={2} cols={["w-16", "w-24", "w-24", "w-16", "w-16", "w-16", "w-12"]} />
      </div>

      {/* Actuals */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-16" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-4 w-4 rounded shrink-0" />
        </div>
      </div>

      {/* Takeoffs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <TableCard rows={3} cols={["w-36", "w-20", "w-16", "w-6"]} />
      </div>
    </div>
  );
}
