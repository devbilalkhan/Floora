import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <div className="border-b border-border bg-muted/40 grid grid-cols-[2fr_1fr_1fr_0.5fr_0.5fr_0.7fr_0.8fr_32px] gap-3 px-3 py-2">
          {["w-14", "w-14", "w-12", "w-10", "w-14", "w-10", "w-14", "w-4"].map((w, i) => (
            <Skeleton key={i} className={`h-2.5 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-border last:border-0 grid grid-cols-[2fr_1fr_1fr_0.5fr_0.5fr_0.7fr_0.8fr_32px] gap-3 items-center px-3 py-2.5"
          >
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-3.5 w-6 ml-auto" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
