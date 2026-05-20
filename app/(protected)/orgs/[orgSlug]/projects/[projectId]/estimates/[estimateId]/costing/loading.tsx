import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1440px] mx-auto py-6 px-4 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Back link */}
      <Skeleton className="h-3.5 w-32" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-7 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
      </div>

      {/* Price list quick links */}
      <div className="flex gap-2">
        {[20, 24, 20, 24].map((w, i) => (
          <Skeleton key={i} className={`h-6 w-${w} rounded-md`} />
        ))}
      </div>

      {/* Costing table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        {/* Table header */}
        <div className="border-b border-black/10 dark:border-white/10 bg-muted/40 flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-8" />
        </div>

        {/* Category groups */}
        {[4, 3, 5, 2].map((count, gi) => (
          <div key={gi}>
            <div className="border-b border-black/10 dark:border-white/10 bg-muted/20 px-2 py-1">
              <Skeleton className="h-3 w-28" />
            </div>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="border-b border-black/10 dark:border-white/10 last:border-0 flex items-center gap-2 px-2 py-2"
              >
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-10" />
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-5 w-14 rounded" />
                <Skeleton className="h-5 w-14 rounded" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
            {/* Consumable rows under each group */}
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={`c-${i}`}
                className="border-b border-black/10 dark:border-white/10 last:border-0 flex items-center gap-2 px-2 py-1.5 bg-muted/10 pl-6"
              >
                <Skeleton className="h-3 w-16 opacity-60" />
                <Skeleton className="h-3 flex-1 opacity-60" />
                <Skeleton className="h-3 w-8 opacity-60" />
                <Skeleton className="h-3 w-12 opacity-60" />
                <Skeleton className="h-3 w-12 opacity-60" />
                <Skeleton className="h-3 w-12 opacity-60" />
                <Skeleton className="h-3 w-14 opacity-60" />
                <Skeleton className="h-3 w-14 opacity-60" />
                <Skeleton className="h-3 w-14 opacity-60" />
                <Skeleton className="h-3 w-16 opacity-60" />
                <div className="w-4" />
              </div>
            ))}
          </div>
        ))}

        {/* Totals footer */}
        <div className="border-t border-black/10 dark:border-white/10 bg-muted/30 flex items-center justify-end gap-6 px-4 py-2">
          {[16, 20, 20, 24].map((w, i) => (
            <div key={i} className="space-y-1 text-right">
              <Skeleton className={`h-2.5 w-${w}`} />
              <Skeleton className={`h-4 w-${w + 4}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
