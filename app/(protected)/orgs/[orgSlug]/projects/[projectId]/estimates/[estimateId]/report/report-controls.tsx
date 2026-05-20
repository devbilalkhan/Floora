"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportControls({
  orgSlug,
  projectId,
  estimateId,
  mode,
}: {
  orgSlug: string;
  projectId: string;
  estimateId: string;
  mode: "summary" | "detailed";
}) {
  const base = `/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/report`;
  const printUrl = `/print/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/report?mode=${mode}`;

  return (
    <div className="flex items-center gap-3 print:hidden">
      <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
        <Link
          href={base}
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
          href={`${base}?mode=detailed`}
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
        onClick={() => window.open(printUrl, "_blank")}
        className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
        Print
      </button>
    </div>
  );
}
