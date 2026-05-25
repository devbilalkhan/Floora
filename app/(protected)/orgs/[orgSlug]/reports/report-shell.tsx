"use client";

import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { fetchReportData } from "./actions";
import { ProjectPicker } from "./project-picker";
import { ReportView } from "./report-view";
import type { ProjectReportData } from "./report-view";
import type { TimelinePoint } from "./report-charts";

type PickerProject = {
  id: string;
  name: string;
  head_client: string | null;
  brand: string;
  status: string;
};

export function ReportShell({
  projects,
  initialReports,
  initialTimeline,
  initialIds,
  orgSlug,
}: {
  projects: PickerProject[];
  initialReports: ProjectReportData[];
  initialTimeline: TimelinePoint[];
  initialIds: string[];
  orgSlug: string;
}) {
  const [reportData, setReportData] = useState<ProjectReportData[]>(initialReports);
  const [timeline, setTimeline] = useState<TimelinePoint[]>(initialTimeline);
  const [currentIds, setCurrentIds] = useState<string[]>(initialIds);
  const [isPending, startTransition] = useTransition();

  function handleApply(ids: string[]) {
    setCurrentIds(ids);

    // Keep URL in sync for shareability without triggering Next.js navigation
    const url = new URL(window.location.href);
    if (ids.length > 0) {
      url.searchParams.set("ids", ids.join(","));
    } else {
      url.searchParams.delete("ids");
    }
    window.history.replaceState({}, "", url.toString());

    if (ids.length === 0) {
      setReportData([]);
      setTimeline([]);
      return;
    }

    startTransition(async () => {
      const { reports, combinedTimeline } = await fetchReportData(ids);
      setReportData(reports);
      setTimeline(combinedTimeline);
    });
  }

  return (
    <div className="space-y-5">
      <ProjectPicker
        projects={projects}
        selectedIds={initialIds}
        onApply={handleApply}
      />

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Loading report…
        </div>
      )}

      {!isPending && reportData.length > 0 && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() =>
                window.open(
                  `/print/orgs/${orgSlug}/reports?ids=${currentIds.join(",")}`,
                  "_blank"
                )
              }
              className="flex items-center gap-1.5 text-xs text-muted-foreground border border-black/10 dark:border-white/10 px-3 py-1.5 rounded-sm hover:text-foreground hover:border-black/20 dark:hover:border-white/20 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
          </div>
          <ReportView projects={reportData} combinedTimeline={timeline} />
        </>
      )}

      {!isPending && reportData.length === 0 && initialIds.length > 0 && (
        <div className="border border-black/10 dark:border-white/10 rounded-sm flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">
            None of the selected projects were found.
          </p>
        </div>
      )}
    </div>
  );
}
