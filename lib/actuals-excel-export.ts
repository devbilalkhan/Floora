import type { Row, Cell } from "exceljs";
import {
  ACCENT_LIGHT,
  SLATE_DARK,
  SLATE_LIGHT,
  BORDER_GREY,
  CURRENCY_FMT,
  PCT_FRACTION_FMT,
  sanitizeFilename,
  downloadBlob,
  titleBlock,
  bandRow,
  type Sheet,
  type CellInput,
} from "@/lib/excel-shared";

const INCOME_ACCENT = "FF10B981";
const INCOME_ACCENT_LIGHT = "FFECFDF5";
const EXPENSE_ACCENT = "FFEF4444";
const EXPENSE_ACCENT_LIGHT = "FFFEF2F2";

const COLS = [
  { header: "Date", width: 11 },
  { header: "Invoice #", width: 13 },
  { header: "Supplier", width: 20 },
  { header: "Description", width: 36 },
  { header: "Code", width: 8 },
  { header: "Qty", width: 9 },
  { header: "Unit Price", width: 11 },
  { header: "Subtotal", width: 13 },
  { header: "Flags", width: 18 },
];
const LAST_COL_LETTER = "I";

export type ActualsGroup = {
  id: string;
  type: "income" | "expense";
  name: string;
  sort_order: number;
};

export type ActualsLineItem = {
  id: string;
  group_id: string;
  sort_order: number;
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
  retention_applied: boolean;
  included_in_totals: boolean;
  code: string | null;
};

function effectiveSubtotal(item: ActualsLineItem): number {
  return item.qty !== null && item.unit_price !== null ? item.qty * item.unit_price : item.subtotal;
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Invoices are ordered alphabetically by supplier name (blank suppliers last);
// ties broken by original insertion order — matches the printable report.
function compareInvoiceBuckets(a: ActualsLineItem[], b: ActualsLineItem[]): number {
  const supplierA = a[0]?.supplier?.trim() || "";
  const supplierB = b[0]?.supplier?.trim() || "";
  if (supplierA && !supplierB) return -1;
  if (!supplierA && supplierB) return 1;
  const cmp = supplierA.localeCompare(supplierB, undefined, { sensitivity: "base" });
  if (cmp !== 0) return cmp;
  return Math.min(...a.map((x) => x.sort_order)) - Math.min(...b.map((x) => x.sort_order));
}

function bucketItems(items: ActualsLineItem[]) {
  const invoiceBuckets = new Map<string, ActualsLineItem[]>();
  const ungrouped: ActualsLineItem[] = [];
  for (const item of items) {
    if (item.invoice_number) {
      const bucket = invoiceBuckets.get(item.invoice_number) ?? [];
      bucket.push(item);
      invoiceBuckets.set(item.invoice_number, bucket);
    } else {
      ungrouped.push(item);
    }
  }
  const orderedBuckets = Array.from(invoiceBuckets.entries()).sort(([, a], [, b]) => compareInvoiceBuckets(a, b));
  return { orderedBuckets, ungrouped };
}

function headerRow(ws: Sheet) {
  const row: Row = ws.addRow(COLS.map((c) => c.header));
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_GREY } } };
    cell.alignment = { vertical: "middle" };
  });
  return row.number;
}

// Section header (Income / Expenses): full-width colored band with the
// section's grand total on the right, mirroring the print report's colour
// coding (green for income, red for expenses) rather than the costing
// sheet's neutral violet — the semantic colour is what makes a P&L scannable.
function sectionHeaderRow(ws: Sheet, label: string, accent: string, total: CellInput) {
  const row: Row = ws.addRow([label]);
  ws.mergeCells(`A${row.number}:G${row.number}`);
  row.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.getCell(8).value = total;
  row.getCell(8).numFmt = CURRENCY_FMT;
  row.getCell(8).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.getCell(8).alignment = { horizontal: "right" };
  row.eachCell({ includeEmpty: true }, (cell: Cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
  });
  return row;
}

// Group name band (light tint of the section colour).
function groupBandRow(ws: Sheet, label: string, accentLight: string) {
  const row: Row = ws.addRow([label]);
  ws.mergeCells(`A${row.number}:${LAST_COL_LETTER}${row.number}`);
  row.getCell(1).font = { bold: true, color: { argb: SLATE_DARK }, size: 9.5 };
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: accentLight } };
  return row;
}

function invoiceSubHeaderRow(ws: Sheet, invoiceNumber: string, supplier: string, count: number, total: number) {
  const row: Row = ws.addRow([
    "",
    "",
    "",
    `Invoice ${invoiceNumber}${supplier ? ` · ${supplier}` : ""} · ${count} item${count !== 1 ? "s" : ""}`,
  ]);
  ws.mergeCells(`A${row.number}:G${row.number}`);
  row.getCell(4).font = { italic: true, color: { argb: "FF64748B" }, size: 9 };
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
  row.eachCell({ includeEmpty: true }, (cell: Cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
  });
  row.getCell(8).value = total;
  row.getCell(8).numFmt = CURRENCY_FMT;
  row.getCell(8).font = { bold: true, color: { argb: "FF64748B" }, size: 9 };
  row.getCell(8).alignment = { horizontal: "right" };
  return row;
}

// A single actuals line item. Subtotal is a live formula (Qty × Unit Price)
// when both are recorded, matching the app's own effectiveSubtotal() logic —
// otherwise it's the literal subtotal, since there's nothing to compute from.
function itemRow(ws: Sheet, item: ActualsLineItem, indent: boolean) {
  const rowNum = ws.rowCount + 1;
  const hasQtyRate = item.qty !== null && item.unit_price !== null;
  const flags = [
    item.retention_applied ? "Retention" : null,
    !item.included_in_totals ? "Excluded" : null,
  ].filter(Boolean).join(", ");

  const row: Row = ws.addRow([
    fmtDate(item.invoice_date),
    item.invoice_number ?? "",
    item.supplier ?? "",
    item.description,
    item.code ?? "",
    item.qty ?? "",
    item.unit_price ?? "",
    hasQtyRate ? { formula: `F${rowNum}*G${rowNum}`, result: effectiveSubtotal(item) } : effectiveSubtotal(item),
    flags,
  ]);
  row.getCell(4).alignment = { indent: indent ? 1 : 0 };
  row.getCell(7).numFmt = CURRENCY_FMT;
  row.getCell(8).numFmt = CURRENCY_FMT;
  if (!item.included_in_totals) {
    row.eachCell((cell: Cell) => {
      cell.font = { ...(cell.font ?? {}), italic: true, color: { argb: "FF94A3B8" } };
    });
  }
  return row;
}

function subtotalRow(ws: Sheet, label: string, rows: number[], total: number) {
  const row: Row = ws.addRow([label]);
  const value = rows.length > 0 ? { formula: `SUM(${rows.map((r) => `H${r}`).join(",")})`, result: total } : 0;
  row.getCell(8).value = value;
  ws.mergeCells(`A${row.number}:G${row.number}`);
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, size: 9.5, color: { argb: SLATE_DARK } };
    cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
  });
  row.getCell(8).numFmt = CURRENCY_FMT;
  row.getCell(8).alignment = { horizontal: "right" };
  return row;
}

// Summary rows share the item table's columns: label merged across A:G,
// single value in column H — same pattern as the costing sheet's Cost
// Build-Up rows, so the block reads as a continuation of the table above.
function summaryRow(
  ws: Sheet,
  label: string,
  value: CellInput,
  opts: { fmt?: string; bold?: boolean; fill?: string; size?: number; topBorder?: boolean; rate?: number } = {}
) {
  const row: Row = ws.addRow([label]);
  if (opts.rate !== undefined) {
    row.getCell(7).value = opts.rate;
    row.getCell(7).numFmt = PCT_FRACTION_FMT;
    row.getCell(7).font = { bold: !!opts.bold, size: opts.size ?? 10, italic: true };
    row.getCell(7).alignment = { horizontal: "right" };
    ws.mergeCells(`A${row.number}:F${row.number}`);
  } else {
    ws.mergeCells(`A${row.number}:G${row.number}`);
  }
  row.getCell(8).value = value;
  row.getCell(1).font = { bold: !!opts.bold, size: opts.size ?? 10 };
  row.getCell(8).font = { bold: !!opts.bold, size: opts.size ?? 10 };
  row.getCell(8).numFmt = opts.fmt ?? CURRENCY_FMT;
  row.getCell(8).alignment = { horizontal: "right" };
  if (opts.fill) {
    [1, 7, 8].forEach((c) => (row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill! } }));
  }
  if (opts.topBorder) {
    [1, 7, 8].forEach((c) => (row.getCell(c).border = { top: { style: "thin", color: { argb: BORDER_GREY } } }));
  }
  return row;
}

type SectionResult = { totalRow: number; total: number; freightRows: number[] };

function buildSection(
  ws: Sheet,
  label: string,
  accent: string,
  accentLight: string,
  groups: ActualsGroup[],
  lineItems: ActualsLineItem[]
): SectionResult {
  const groupItems = (gId: string) => lineItems.filter((i) => i.group_id === gId);
  const included = (i: ActualsLineItem) => i.included_in_totals;

  const groupTotalRows: number[] = [];
  const freightRows: number[] = [];
  const sectionTotal = groups.reduce(
    (s, g) => s + groupItems(g.id).filter(included).reduce((a, i) => a + effectiveSubtotal(i), 0),
    0
  );

  sectionHeaderRow(ws, label.toUpperCase(), accent, sectionTotal);

  for (const group of groups) {
    const items = groupItems(group.id);
    if (items.length === 0) continue;

    groupBandRow(ws, group.name, accentLight);
    const includedRows: number[] = [];
    const { orderedBuckets, ungrouped } = bucketItems(items);

    for (const [invoiceNumber, invItems] of orderedBuckets) {
      const invTotal = invItems.filter(included).reduce((s, i) => s + effectiveSubtotal(i), 0);
      invoiceSubHeaderRow(ws, invoiceNumber, invItems[0]?.supplier?.trim() ?? "", invItems.length, invTotal);
      for (const item of invItems) {
        const row = itemRow(ws, item, true);
        if (item.included_in_totals) includedRows.push(row.number);
        if (item.code === "FR" && item.included_in_totals) freightRows.push(row.number);
      }
    }
    for (const item of ungrouped) {
      const row = itemRow(ws, item, false);
      if (item.included_in_totals) includedRows.push(row.number);
      if (item.code === "FR" && item.included_in_totals) freightRows.push(row.number);
    }

    const groupTotal = items.filter(included).reduce((s, i) => s + effectiveSubtotal(i), 0);
    const subRow = subtotalRow(ws, `${group.name} subtotal`, includedRows, groupTotal);
    groupTotalRows.push(subRow.number);
    ws.addRow([]);
  }

  const totalRow = summaryRow(
    ws,
    `TOTAL ${label.toUpperCase()}`,
    groupTotalRows.length > 0
      ? { formula: `SUM(${groupTotalRows.map((r) => `H${r}`).join(",")})`, result: sectionTotal }
      : 0,
    { bold: true, topBorder: true, fill: accentLight }
  );
  ws.addRow([]);

  return { totalRow: totalRow.number, total: sectionTotal, freightRows };
}

export type EstimateComparison = {
  estimateName: string;
  totalExGst: number;
  grossMarginPct: number; // fraction, 0–1
};

type BuildActualsExcelArgs = {
  orgName: string;
  projectName: string;
  groups: ActualsGroup[];
  lineItems: ActualsLineItem[];
  adminFeePct: number | null;
  adminFeeEstimatedCost: number | null;
  retentionPct: number | null;
  retentionReleased: number;
  estimateComparison?: EstimateComparison | null;
};

function actualsExcelFilename(projectName: string): string {
  return `${sanitizeFilename(`${projectName} - Actuals`)}.xlsx`;
}

async function buildActualsExcelBuffer({
  orgName,
  projectName,
  groups,
  lineItems,
  adminFeePct,
  adminFeeEstimatedCost,
  retentionPct,
  retentionReleased,
  estimateComparison,
}: BuildActualsExcelArgs): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = orgName;
  wb.created = new Date();

  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const ws = wb.addWorksheet("Actuals");
  ws.columns = COLS.map((c) => ({ width: c.width }));

  titleBlock(ws, LAST_COL_LETTER, [
    { text: orgName, size: 15, bold: true, color: SLATE_DARK },
    { text: `${projectName} — Actuals`, size: 11, bold: true },
    { text: `Generated ${today}   ·   All amounts exclude GST`, size: 9, color: "FF64748B" },
  ]);

  const headerRowNum = headerRow(ws);
  ws.views = [{ state: "frozen", ySplit: headerRowNum }];

  const incomeGroups = groups.filter((g) => g.type === "income").sort((a, b) => a.sort_order - b.sort_order);
  const expenseGroups = groups.filter((g) => g.type === "expense").sort((a, b) => a.sort_order - b.sort_order);

  const income = buildSection(ws, "Income", INCOME_ACCENT, INCOME_ACCENT_LIGHT, incomeGroups, lineItems);
  const expense = buildSection(ws, "Expenses", EXPENSE_ACCENT, EXPENSE_ACCENT_LIGHT, expenseGroups, lineItems);

  // All P&L figures below are computed in JS (matching actuals-page-client.tsx's
  // formulas exactly) and written as the cached `result` alongside each live
  // formula, so the sheet shows correct numbers immediately — before Excel
  // has recalculated anything — just like the costing export.
  const incomeTotal = income.total;
  const expensesTotal = expense.total;
  const adminFeeBase = adminFeeEstimatedCost ?? expensesTotal;
  const adminFeeAmount =
    adminFeePct != null && adminFeePct > 0 ? Math.round(adminFeeBase * (adminFeePct / 100) * 100) / 100 : null;
  const totalCost = expensesTotal + (adminFeeAmount ?? 0);
  const grossProfit = incomeTotal - totalCost;
  const gpPct = incomeTotal > 0 ? grossProfit / incomeTotal : 0;

  // ── Admin fee ─────────────────────────────────────────────────────────────
  let adminFeeRow: number | null = null;
  if (adminFeePct != null && adminFeePct > 0) {
    const baseTerm = adminFeeEstimatedCost != null ? String(adminFeeEstimatedCost) : `H${expense.totalRow}`;
    const rateRowNum = ws.rowCount + 1;
    const row = summaryRow(
      ws,
      "Admin & Other Fee",
      { formula: `(${baseTerm})*G${rateRowNum}`, result: adminFeeAmount! },
      { rate: adminFeePct / 100 }
    );
    adminFeeRow = row.number;
  }

  // ── Summary (P&L build-up) ──────────────────────────────────────────────
  bandRow(ws, LAST_COL_LETTER, "Summary");

  const incomeRow = summaryRow(ws, "Total Income", { formula: `H${income.totalRow}`, result: incomeTotal }, { bold: true });
  const expensesRow = summaryRow(ws, "Total Expenses", { formula: `H${expense.totalRow}`, result: expensesTotal }, {});
  const adminFeeSummaryRow = adminFeeRow
    ? summaryRow(ws, "Admin & Other Fee", { formula: `H${adminFeeRow}`, result: adminFeeAmount! }, {})
    : null;

  const totalCostTerms = [`H${expensesRow.number}`];
  if (adminFeeSummaryRow) totalCostTerms.push(`H${adminFeeSummaryRow.number}`);
  const totalCostRow = summaryRow(
    ws,
    "Total Cost",
    { formula: totalCostTerms.join("+"), result: totalCost },
    { bold: true, topBorder: true }
  );

  const gpRow = summaryRow(
    ws,
    "Gross Profit",
    { formula: `H${incomeRow.number}-H${totalCostRow.number}`, result: grossProfit },
    { bold: true, topBorder: true, fill: ACCENT_LIGHT }
  );

  const gpPctRow = summaryRow(
    ws,
    "Gross Profit %",
    { formula: `IFERROR(H${gpRow.number}/H${incomeRow.number},0)`, result: gpPct },
    { fmt: PCT_FRACTION_FMT }
  );

  if (retentionPct != null) {
    // Retention is only ever held against a subset of income lines (those
    // flagged retention_applied), so unlike Total Income/Expenses above this
    // has no single row to reference — the base is captured as a literal,
    // matching the figure the app itself displays, while the rate stays a
    // live editable cell.
    const retentionBase = lineItems
      .filter((i) => incomeGroups.some((g) => g.id === i.group_id) && i.retention_applied && i.included_in_totals)
      .reduce((s, i) => s + effectiveSubtotal(i), 0);
    const retentionHeld = retentionBase * (retentionPct / 100);

    const rateRowNum = ws.rowCount + 1;
    const retentionHeldRow = summaryRow(
      ws,
      "Retention Held",
      { formula: `${retentionBase}*G${rateRowNum}`, result: retentionHeld },
      { rate: retentionPct / 100, topBorder: true }
    );
    const releasedRow = summaryRow(ws, "Retention Released", retentionReleased, {});
    summaryRow(
      ws,
      "Net Receivable",
      {
        formula: `H${incomeRow.number}-(H${retentionHeldRow.number}-H${releasedRow.number})`,
        result: incomeTotal - (retentionHeld - retentionReleased),
      },
      { bold: true }
    );
  }

  const freightRowNums = [...income.freightRows, ...expense.freightRows];
  if (freightRowNums.length > 0) {
    const groupTypeMap = new Map(groups.map((g) => [g.id, g.type]));
    const freightTotal = lineItems
      .filter((i) => i.code === "FR" && i.included_in_totals && groupTypeMap.has(i.group_id))
      .reduce((s, i) => s + effectiveSubtotal(i), 0);
    summaryRow(
      ws,
      "Total Freight",
      { formula: `SUM(${freightRowNums.map((r) => `H${r}`).join(",")})`, result: freightTotal },
      {}
    );
  }

  // ── vs Estimate ──────────────────────────────────────────────────────────
  if (estimateComparison) {
    const variance = incomeTotal - estimateComparison.totalExGst;
    const variancePct = estimateComparison.totalExGst !== 0 ? variance / estimateComparison.totalExGst : 0;
    const gpVariance = gpPct - estimateComparison.grossMarginPct;

    ws.addRow([]);
    bandRow(ws, LAST_COL_LETTER, `vs Estimate — ${estimateComparison.estimateName}`);
    const estValueRow = summaryRow(ws, "Estimate Value (ex GST)", estimateComparison.totalExGst, { bold: true });
    const actualIncomeRow = summaryRow(ws, "Actual Income", { formula: `H${incomeRow.number}`, result: incomeTotal }, {});
    const varianceRow = summaryRow(
      ws,
      "Variance $",
      { formula: `H${actualIncomeRow.number}-H${estValueRow.number}`, result: variance },
      { bold: true }
    );
    summaryRow(
      ws,
      "Variance %",
      { formula: `IFERROR(H${varianceRow.number}/H${estValueRow.number},0)`, result: variancePct },
      { fmt: PCT_FRACTION_FMT }
    );
    const estGpRow = summaryRow(ws, "Estimate GP %", estimateComparison.grossMarginPct, { fmt: PCT_FRACTION_FMT });
    const actualGpRow = summaryRow(
      ws,
      "Actual GP %",
      { formula: `H${gpPctRow.number}`, result: gpPct },
      { fmt: PCT_FRACTION_FMT }
    );
    summaryRow(
      ws,
      "GP Variance (pts)",
      { formula: `H${actualGpRow.number}-H${estGpRow.number}`, result: gpVariance },
      { fmt: PCT_FRACTION_FMT, bold: true }
    );
  }

  return wb.xlsx.writeBuffer();
}

export async function exportActualsExcel(args: BuildActualsExcelArgs): Promise<void> {
  const buf = await buildActualsExcelBuffer(args);
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, actualsExcelFilename(args.projectName));
}
