import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
      {/* Section header */}
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
        <Skeleton className="h-3.5 w-1.5 rounded-full" />
        <Skeleton className="h-2.5 w-28" />
      </div>
      {/* Table header */}
      <div className="border-b border-border bg-muted/10 flex items-center gap-2 px-3 py-1.5">
        <Skeleton className="h-2.5 flex-1" />
        <Skeleton className="h-2.5 w-14 text-right" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border last:border-0 flex items-center gap-2 px-3 py-2"
        >
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-28" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <SectionSkeleton rows={5} />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
    </div>
  );
}
