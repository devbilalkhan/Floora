"use client";

import { useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";
import { exportEstimateExcel } from "@/lib/estimate-excel-export";

export function EstimateExcelExportButton({
  orgName,
  projectName,
  estimate,
  items,
  wetAreas,
}: {
  orgName: string;
  projectName: string;
  estimate: Estimate;
  items: EstimateItem[];
  wetAreas: WetArea[];
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

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
      {loading ? "Exporting…" : "Export Excel"}
    </button>
  );
}
