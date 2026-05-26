"use client";

import { Download } from "lucide-react";

export type CsvRow = {
  section: string;
  code: string;
  manufacturer: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  note: string;
};

function escape(v: string | number) {
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function CsvExportButton({
  rows,
  filename,
}: {
  rows: CsvRow[];
  filename: string;
}) {
  const handleExport = () => {
    const headers = ["Section", "Code", "Manufacturer", "Description", "Qty", "Unit", "Rate ($/u)", "Total ($)", "Note"];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [r.section, r.code, r.manufacturer, r.description, r.qty, r.unit, r.rate, r.total, r.note]
          .map(escape)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
  );
}
