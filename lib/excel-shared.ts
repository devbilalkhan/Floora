import type { Worksheet, Row } from "exceljs";

// ── Style tokens (matches app's violet dark-glass accent) ─────────────────────
export const ACCENT = "FF713EE9";
export const ACCENT_LIGHT = "FFEDE9FE";
export const SLATE_DARK = "FF1E293B";
export const SLATE_LIGHT = "FFF8FAFC";
export const BORDER_GREY = "FFCBD5E1";

export const CURRENCY_FMT = '"$"#,##0.00';
export const QTY_FMT = "#,##0.00";
export const PCT_100_FMT = '0.00"%"'; // stored 0–100
export const PCT_FRACTION_FMT = "0.00%"; // stored 0–1

// A formula cell carries the live formula plus a cached result so the
// exported file shows correct numbers immediately, before Excel recalculates.
export type FormulaValue = { formula: string; result: number };
export type CellInput = number | FormulaValue;

export type Sheet = Worksheet;

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function titleBlock(
  ws: Sheet,
  lastColLetter: string,
  lines: { text: string; size: number; bold?: boolean; color?: string }[]
) {
  lines.forEach((line) => {
    const row: Row = ws.addRow([line.text]);
    ws.mergeCells(`A${row.number}:${lastColLetter}${row.number}`);
    const cell = row.getCell(1);
    cell.font = { size: line.size, bold: !!line.bold, color: { argb: line.color ?? SLATE_DARK } };
  });
  ws.addRow([]);
}

export function bandRow(
  ws: Sheet,
  lastColLetter: string,
  label: string,
  opts: { fill?: string; textColor?: string; italic?: boolean; size?: number } = {}
) {
  const row: Row = ws.addRow([label]);
  ws.mergeCells(`A${row.number}:${lastColLetter}${row.number}`);
  const cell = row.getCell(1);
  cell.font = {
    bold: !opts.italic,
    italic: !!opts.italic,
    color: { argb: opts.textColor ?? "FFFFFFFF" },
    size: opts.size ?? 10.5,
  };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill ?? ACCENT } };
  return row;
}
