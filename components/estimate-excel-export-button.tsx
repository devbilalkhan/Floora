"use client";

import { useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";
import { exportEstimateExcel } from "@/lib/estimate-excel-export";

export function EstimateExcelExportButton({
  orgName,
  projectName,
  estimate,
  items,
  wetAreas,
  variant = "default",
}: {
  orgName: string;
  projectName: string;
  estimate: Estimate;
  items: EstimateItem[];
  wetAreas: WetArea[];
  variant?: "default" | "compact";
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportEstimateExcel({ orgName, projectName, estimate, items, wetAreas });
    } catch {
      toast.error("Failed to export Excel.");
    } finally {
      setLoading(false);
    }
  };

  const isCompact = variant === "compact";

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={cn(
        "flex items-center text-xs transition-colors disabled:opacity-50 disabled:cursor-wait",
        isCompact
          ? "gap-1 border border-primary/30 rounded px-2 py-0.5 text-primary/80 hover:text-primary"
          : "gap-1.5 border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30"
      )}
    >
      {loading ? (
        <RefreshCw className={cn(isCompact ? "h-2.5 w-2.5" : "h-3.5 w-3.5", "animate-spin")} />
      ) : (
        <FileSpreadsheet className={isCompact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
      )}
      {loading ? "Exporting…" : "Export Excel"}
    </button>
  );
}
