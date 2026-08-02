import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      {/* Header: title + search + action buttons */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-24 shrink-0" />
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 w-28 shrink-0" />
        <Skeleton className="h-8 w-32 shrink-0" />
      </div>

      {/* Projects table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-14" /></th>
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-14" /></th>
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-12" /></th>
              <th className="text-right px-2 py-1.5"><Skeleton className="h-2.5 w-12 ml-auto" /></th>
              <th className="text-right px-2 py-1.5"><Skeleton className="h-2.5 w-10 ml-auto" /></th>
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-24" /></th>
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-10" /></th>
              <th className="text-left px-2 py-1.5"><Skeleton className="h-2.5 w-14" /></th>
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-black/10 dark:border-white/10 last:border-0">
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-36" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-24" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-20" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-4 ml-auto" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-4 ml-auto" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-4.5 w-16 rounded-full" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-4.5 w-14 rounded-full" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-3.5 w-16" /></td>
                <td className="px-2 py-1.5"><Skeleton className="h-4 w-4 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer: count + pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-black/10 dark:border-white/10 bg-card/65">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  );
}
