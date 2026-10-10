import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full py-6 px-8 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Job defaults */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 flex flex-wrap gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>

      {/* Lines table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        <Skeleton className="h-8 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-none opacity-50 border-t border-black/5 dark:border-white/5" />
        ))}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <Skeleton className="h-24 w-80 rounded-xl" />
      </div>
    </div>
  );
}
