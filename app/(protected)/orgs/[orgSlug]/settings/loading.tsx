import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Title */}
      <Skeleton className="h-7 w-52" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-none" />
        ))}
      </div>

      {/* Logo section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-28 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
      </div>

      {/* Form fields */}
      <Skeleton className="h-5 w-44" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
      <Skeleton className="h-10 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  );
}
