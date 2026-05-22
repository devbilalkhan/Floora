import { Skeleton } from "@/components/ui/skeleton";

// Mirrors INIT_WIDTHS from takeoff-table.tsx
const COL_WIDTHS = [32, 84, 124, 100, 68, 84, 60, 72, 52, 56, 56, 56, 56, 252, 32];
const TABLE_WIDTH = COL_WIDTHS.reduce((s, w) => s + w, 0);

const HEADERS = [
  ["#",                    "text-center"],
  ["Code",                 "text-left"],
  ["Manufacturer / Range", "text-left"],
  ["Description",          "text-left"],
  ["Colour",               "text-left"],
  ["Location",             "text-left"],
  ["Level",                "text-left"],
  ["Qty",                  "text-right"],
  ["Unit",                 "text-left"],
  ["Waste %",              "text-right"],
  ["Wastage",              "text-right"],
  ["Parent Code",          "text-left"],
  ["Cove H.",              "text-left"],
  ["Notes / Ref",          "text-left"],
  ["",                     ""],
] as [string, string][];

// Row content skeleton widths per column (0 = no skeleton / empty)
const ROW_SKELETONS = [10, 52, 72, 100, 44, 52, 36, 36, 28, 28, 32, 0, 0, 80, 0];

function SkeletonRow() {
  return (
    <tr className="border-b border-black/10 dark:border-white/10">
      {ROW_SKELETONS.map((w, i) => (
        <td
          key={i}
          className={`px-2 py-1.5 ${i < ROW_SKELETONS.length - 1 ? "border-r border-black/10 dark:border-white/10" : ""}`}
        >
          {w > 0 && (
            <Skeleton
              className="h-3.5"
              style={{ width: w }}
            />
          )}
        </td>
      ))}
    </tr>
  );
}

function CategoryGroupSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <>
      {/* Category header */}
      <tr className="border-t border-b border-black/10 dark:border-white/10 bg-muted/20">
        <td colSpan={15} className="px-3 py-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </td>
      </tr>
      {/* Data rows */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  );
}

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

      {/* Takeoff selector */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-80 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-20 rounded-sm" />
      </div>

      {/* Takeoff table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden bg-card/65">
        <div className="overflow-x-auto">
          <table
            className="border-collapse"
            style={{ width: TABLE_WIDTH, tableLayout: "fixed" }}
          >
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>

            <thead>
              <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                {HEADERS.map(([label, align], i) => (
                  <th
                    key={i}
                    className={`px-2 py-1.5 border-r border-black/10 dark:border-white/10 last:border-r-0 ${align}`}
                  >
                    {label && (
                      <Skeleton
                        className="h-2.5 inline-block"
                        style={{ width: Math.max(16, label.length * 5.5) }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <CategoryGroupSkeleton rowCount={5} />
              <CategoryGroupSkeleton rowCount={3} />
              <CategoryGroupSkeleton rowCount={4} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals bar */}
      <div className="flex items-center gap-6 px-4 py-2 bg-card/65 border border-black/10 dark:border-white/10 rounded-sm">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>

      {/* Code summary */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden bg-card/65">
        <div className="px-3 py-1.5 border-b border-black/10 dark:border-white/10 bg-muted/40 flex items-center justify-between">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
        <div className="p-2 space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-1">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
