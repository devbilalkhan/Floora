"use client";

import { useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ProtectionExcelArgs } from "@/lib/protection-excel-export";

/** Exports the estimate as it is on screen (unsaved edits included). exceljs loads on click. */
export function ProtectionExcelExportButton({ getArgs }: { getArgs: () => ProtectionExcelArgs }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { exportProtectionExcel } = await import("@/lib/protection-excel-export");
      await exportProtectionExcel(getArgs());
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
      className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 disabled:opacity-50 disabled:cursor-wait"
    >
      {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
      {loading ? "Exporting…" : "Export Excel"}
    </button>
  );
}
