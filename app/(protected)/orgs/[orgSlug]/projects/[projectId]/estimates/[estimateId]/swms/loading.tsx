import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1200px] mx-auto py-6 px-4 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-12" />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Two-column layout: editor + panel */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* Left: main editor */}
        <div className="space-y-4">
          {/* Project info card */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Hazards section */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>

          {/* Workers section */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: panel */}
        <div className="space-y-3">
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
