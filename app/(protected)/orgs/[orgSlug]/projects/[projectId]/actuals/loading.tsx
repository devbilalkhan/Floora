import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Margin dashboard skeleton */}
      <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-sm p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Income table skeleton */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
          <div className="bg-muted/40 flex items-center gap-3 px-3 py-2">
            {["w-24", "w-20", "w-40", "w-12", "w-16", "w-16"].map((w, i) => (
              <Skeleton key={i} className={`h-2.5 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-black/5 dark:border-white/5">
              {["w-24", "w-20", "w-40", "w-12", "w-16", "w-16"].map((w, j) => (
                <Skeleton key={j} className={`h-3 ${w}`} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Expense table skeleton */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
          <div className="bg-muted/40 flex items-center gap-3 px-3 py-2">
            {["w-24", "w-20", "w-40", "w-12", "w-16", "w-16"].map((w, i) => (
              <Skeleton key={i} className={`h-2.5 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-black/5 dark:border-white/5">
              {["w-24", "w-20", "w-40", "w-12", "w-16", "w-16"].map((w, j) => (
                <Skeleton key={j} className={`h-3 ${w}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
