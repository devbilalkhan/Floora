"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActualGroup, ActualLineItem } from "./actuals-section";

const HEADERS = [
  "Type", "Group", "Invoice #", "Date", "Supplier/Builder", "Description",
  "Qty", "Unit Price", "Subtotal", "Included", "Retention Applied",
];

type ExportRow = {
  type: "Income" | "Expense";
  group: string;
  invoiceNumber: string;
  date: string;
  supplier: string;
  description: string;
  qty: number | string;
  unitPrice: number | string;
  subtotal: number;
  included: boolean;
  retentionApplied: boolean;
};

function effectiveSubtotal(item: ActualLineItem): number {
  return item.qty !== null && item.unit_price !== null ? item.qty * item.unit_price : item.subtotal;
}

function buildRows(groups: ActualGroup[], lineItems: ActualLineItem[]): ExportRow[] {
  const groupMap = new Map(groups.map(g => [g.id, g] as const));
  return lineItems
    .filter(i => groupMap.has(i.group_id))
    .map(i => {
      const group = groupMap.get(i.group_id)!;
      return {
        type: group.type === "income" ? "Income" as const : "Expense" as const,
        group: group.name,
        invoiceNumber: i.invoice_number ?? "",
        date: i.invoice_date ?? "",
        supplier: i.supplier ?? "",
        description: i.description,
        qty: i.qty ?? "",
        unitPrice: i.unit_price ?? "",
        subtotal: effectiveSubtotal(i),
        included: i.included_in_totals,
        retentionApplied: i.retention_applied,
      };
    });
}

function rowToArray(r: ExportRow) {
  return [
    r.type, r.group, r.invoiceNumber, r.date, r.supplier, r.description,
    r.qty, r.unitPrice, r.subtotal, r.included ? "Yes" : "No", r.retentionApplied ? "Yes" : "No",
  ];
}

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

function escapeCsv(v: string | number) {
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActualsExportButton({
  projectName,
  incomeGroups,
  expenseGroups,
  allLineItems,
}: {
  projectName: string;
  incomeGroups: ActualGroup[];
  expenseGroups: ActualGroup[];
  allLineItems: ActualLineItem[];
}) {
  const baseFilename = `${sanitizeFilename(projectName)} - Actuals`;

  function exportCsv() {
    const rows = buildRows([...incomeGroups, ...expenseGroups], allLineItems);
    const lines = [HEADERS.join(","), ...rows.map(r => rowToArray(r).map(escapeCsv).join(","))];
    download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${baseFilename}.csv`);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    function addSheet(name: string, groups: ActualGroup[]) {
      const rows = buildRows(groups, allLineItems);
      const total = rows.filter(r => r.included).reduce((s, r) => s + r.subtotal, 0);
      const data: (string | number)[][] = [
        HEADERS,
        ...rows.map(rowToArray),
        [],
        ["", "", "", "", "", "", "", "Total (included)", total],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
    }

    addSheet("Income", incomeGroups);
    addSheet("Expenses", expenseGroups);
    XLSX.writeFile(wb, `${baseFilename}.xlsx`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors">
          <Download className="h-3.5 w-3.5" />
          Export
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 text-xs">
        <DropdownMenuItem onClick={exportCsv} className="text-xs cursor-pointer">
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} className="text-xs cursor-pointer">
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
