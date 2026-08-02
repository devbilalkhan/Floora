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
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
      </div>

      {/* Price list quick links */}
      <div className="flex gap-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-24" />
      </div>

      {/* Rate settings toolbar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-card/65 backdrop-blur-xl border border-border rounded-sm px-4 py-2.5">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-32" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-10 rounded" />
        </div>
      </div>

      {/* Line items table */}
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
          {["w-16", "w-20", "w-20", "w-24"].map((w, i) => (
            <div key={i} className="space-y-1 text-right">
              <Skeleton className={`h-2.5 ${w}`} />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Additional costs row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-card/65 backdrop-blur-xl border border-border rounded-sm px-4 py-2.5">
        <Skeleton className="h-2.5 w-24" />
        {["w-20", "w-24", "w-20", "w-24"].map((w, i) => (
          <Skeleton key={i} className={`h-5 ${w}`} />
        ))}
      </div>

      {/* Wet Areas panel */}
      <div className="space-y-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border border-border rounded-t-sm border-b-0">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="border border-border rounded-b-sm overflow-hidden">
          <div className="flex items-center gap-4 px-3 py-1.5 bg-muted/10 border-b border-border">
            {["w-16", "w-12", "w-14", "w-14", "w-14", "w-14", "w-16"].map((w, i) => (
              <Skeleton key={i} className={`h-2.5 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-2 border-b border-border last:border-0">
              {["w-16", "w-12", "w-14", "w-14", "w-14", "w-14", "w-16"].map((w, j) => (
                <Skeleton key={j} className={`h-3 ${w}`} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Cost Summary + Floor Prep */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
            <div className="px-4 pt-3 pb-2.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="border-t-2 border-primary/25 bg-primary/[0.07] px-4 py-4 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
        </div>
        <div className="w-72 shrink-0 bg-card/65 backdrop-blur-xl border border-border rounded-sm p-3 space-y-2.5">
          <Skeleton className="h-2.5 w-20" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      </div>

      {/* Notes + Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card/65 backdrop-blur-xl border border-border rounded-sm p-4 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
