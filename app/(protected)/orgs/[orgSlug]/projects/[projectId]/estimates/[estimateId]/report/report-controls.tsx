"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { EstimateExcelExportButton } from "@/components/estimate-excel-export-button";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";

export function ReportControls({
  orgSlug,
  projectId,
  estimateId,
  mode,
  levels,
  level,
  orgName,
  projectName,
  estimate,
  items,
  wetAreas,
}: {
  orgSlug: string;
  projectId: string;
  estimateId: string;
  mode: "summary" | "detailed";
  levels: string[];
  level: string;
  orgName: string;
  projectName: string;
  estimate: Estimate;
  items: EstimateItem[];
  wetAreas: WetArea[];
}) {
  const base = `/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/report`;

  const buildUrl = (newLevel: string, newMode: string) => {
    const params = new URLSearchParams();
    if (newMode !== "summary") params.set("mode", newMode);
    if (newLevel !== "all") params.set("level", newLevel);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="flex items-center gap-3 print:hidden">
      {/* Level selector — only shown when estimate has multiple levels */}
      {levels.length > 1 && (
        <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
          {(["all", ...levels] as string[]).map((lvl, i) => (
            <Link
              key={lvl}
              href={buildUrl(lvl, mode)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                i > 0 && "border-l border-border",
                level === lvl
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {lvl === "all" ? "All" : lvl}
            </Link>
          ))}
        </div>
      )}

      {/* Summary / Detailed toggle */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
        <Link
          href={buildUrl(level, "summary")}
          className={cn(
            "px-3 py-1.5 transition-colors",
            mode === "summary"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Summary
        </Link>
        <Link
          href={buildUrl(level, "detailed")}
          className={cn(
            "px-3 py-1.5 transition-colors border-l border-border",
            mode === "detailed"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Detailed
        </Link>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
        Print
      </button>

      <EstimateExcelExportButton
        orgName={orgName}
        projectName={projectName}
        estimate={estimate}
        items={items}
        wetAreas={wetAreas}
      />
    </div>
  );
}
