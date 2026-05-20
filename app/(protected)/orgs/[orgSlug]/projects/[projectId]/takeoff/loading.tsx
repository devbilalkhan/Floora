import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1440px] mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-32" />
        </div>
      </div>

      {/* Takeoff selector tabs */}
      <div className="flex gap-1.5">
        {[32, 28, 24].map((w, i) => (
          <Skeleton key={i} className={`h-7 w-${w} rounded-sm`} />
        ))}
      </div>

      {/* Takeoff table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        {/* Table header */}
        <div className="border-b border-black/10 dark:border-white/10 bg-muted/40 flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-2.5 w-4" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-8" />
        </div>

        {/* Category group header + rows */}
        {[5, 3, 4, 6].map((count, gi) => (
          <div key={gi}>
            <div className="border-b border-black/10 dark:border-white/10 bg-muted/20 px-2 py-1">
              <Skeleton className="h-3 w-28" />
            </div>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="border-b border-black/10 dark:border-white/10 last:border-0 flex items-center gap-2 px-2 py-1.5"
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-3.5 w-10" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
