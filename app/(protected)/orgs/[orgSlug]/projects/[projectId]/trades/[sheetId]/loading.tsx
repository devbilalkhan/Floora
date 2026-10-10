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

      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        <Skeleton className="h-8 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-px border-t border-black/5 dark:border-white/5">
            <Skeleton className="h-8 w-10 rounded-none" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-8 flex-1 rounded-none opacity-50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
