import type { Worksheet, Row, Cell } from "exceljs";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";
import { itemMatQty, itemMatCost, itemLabCost, itemTotal, computeSummary, computeWetAreaLabor } from "@/lib/estimate-types";
import { CATEGORIES } from "@/lib/takeoff-types";

// ── Style tokens (matches app's violet dark-glass accent) ─────────────────────
const ACCENT = "FF713EE9";
const ACCENT_LIGHT = "FFEDE9FE";
const SLATE_DARK = "FF1E293B";
const SLATE_LIGHT = "FFF8FAFC";
const BORDER_GREY = "FFCBD5E1";

const CURRENCY_FMT = '"$"#,##0.00';
const QTY_FMT = "#,##0.00";
const PCT_100_FMT = '0.00"%"'; // waste_pct is stored 0–100
const PCT_FRACTION_FMT = "0.00%"; // rates stored 0–1

const DETAIL_COLS = [
  { header: "Code", width: 10 },
  { header: "Description", width: 36 },
  { header: "Qty", width: 9 },
  { header: "Unit", width: 7 },
  { header: "Waste %", width: 9 },
  { header: "Eff. Qty", width: 9 },
  { header: "Mat $/u", width: 10 },
  { header: "Lab $/u", width: 10 },
  { header: "Mat $", width: 12 },
  { header: "Lab $", width: 12 },
  { header: "Total $", width: 13 },
];
const LAST_COL_LETTER = "K";

// A formula cell carries the live formula plus a cached result so the
// exported file shows correct numbers immediately, before Excel recalculates.
type FormulaValue = { formula: string; result: number };
type CellInput = number | FormulaValue;

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Sheet = Worksheet;

function titleBlock(ws: Sheet, lines: { text: string; size: number; bold?: boolean; color?: string }[]) {
  lines.forEach((line) => {
    const row: Row = ws.addRow([line.text]);
    ws.mergeCells(`A${row.number}:${LAST_COL_LETTER}${row.number}`);
    const cell = row.getCell(1);
    cell.font = { size: line.size, bold: !!line.bold, color: { argb: line.color ?? SLATE_DARK } };
  });
  ws.addRow([]);
}

function headerRow(ws: Sheet) {
  const row: Row = ws.addRow(DETAIL_COLS.map((c) => c.header));
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_GREY } } };
    cell.alignment = { vertical: "middle" };
  });
  return row.number;
}

function categoryBandRow(ws: Sheet, label: string) {
  const row: Row = ws.addRow([label]);
  ws.mergeCells(`A${row.number}:${LAST_COL_LETTER}${row.number}`);
  const cell = row.getCell(1);
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
}

function subBandRow(ws: Sheet, label: string) {
  const row: Row = ws.addRow([label]);
  ws.mergeCells(`A${row.number}:${LAST_COL_LETTER}${row.number}`);
  const cell = row.getCell(1);
  cell.font = { italic: true, color: { argb: "FF64748B" }, size: 9 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
}

// Eff. Qty = (Qty + cov_area) * (1 + Waste%/100). cov_area has no column of its
// own (rare, coving-only), so it's baked into the formula as a constant offset;
// Qty and Waste% stay live-editable. Consumables always have waste_pct = 0, so
// the same formula collapses to plain Qty for them — matching itemMatQty().
function itemRow(ws: Sheet, item: EstimateItem, row_: number, opts: { indent?: boolean } = {}) {
  const covArea = item.cov_area ?? 0;
  const effQtyFormula = covArea !== 0 ? `(C${row_}+${covArea})*(1+E${row_}/100)` : `C${row_}*(1+E${row_}/100)`;

  const row: Row = ws.addRow([
    item.finish_code ?? "",
    item.description ?? "",
    item.qty,
    item.unit,
    item.waste_pct,
    { formula: effQtyFormula, result: itemMatQty(item) },
    item.mat_rate,
    item.lab_rate,
    { formula: `F${row_}*G${row_}`, result: itemMatCost(item) },
    { formula: `C${row_}*H${row_}`, result: itemLabCost(item) },
    { formula: `I${row_}+J${row_}`, result: itemTotal(item) },
  ]);
  row.getCell(2).alignment = { indent: opts.indent ? 2 : 0 };
  row.getCell(2).font = { bold: !opts.indent, color: { argb: opts.indent ? "FF64748B" : SLATE_DARK }, size: opts.indent ? 9.5 : 10 };
  [3, 6].forEach((c) => (row.getCell(c).numFmt = QTY_FMT));
  row.getCell(5).numFmt = PCT_100_FMT;
  [7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
  return row;
}

// Subtotal row summing Mat $ / Lab $ over [startRow, endRow] (inclusive); Total $
// is the sum of that row's own Mat $ + Lab $ cells. Band/label rows inside the
// range are ignored automatically since SUM() skips non-numeric cells.
function subtotalRow(ws: Sheet, label: string, matSum: number, labSum: number, range: { start: number; end: number }) {
  const row: Row = ws.addRow([label]);
  const rowNum = row.number;
  row.getCell(9).value = { formula: `SUM(I${range.start}:I${range.end})`, result: matSum };
  row.getCell(10).value = { formula: `SUM(J${range.start}:J${range.end})`, result: labSum };
  row.getCell(11).value = { formula: `I${rowNum}+J${rowNum}`, result: matSum + labSum };
  ws.mergeCells(`A${rowNum}:H${rowNum}`);
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, size: 9.5, color: { argb: SLATE_DARK } };
    cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
  });
  [9, 10, 11].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
  return row;
}

type CategorySubtotal = { key: string; label: string; row: number; mat: number; lab: number };

type DetailResult = {
  categorySubtotals: CategorySubtotal[];
  wetAreasTotalRow: number | null;
  itemsSubtotalRow: number;
};

function buildDetailSheet(
  ws: Sheet,
  orgName: string,
  projectName: string,
  estimate: Estimate,
  items: EstimateItem[],
  wetAreas: WetArea[],
  today: string
): DetailResult {
  ws.columns = DETAIL_COLS.map((c) => ({ width: c.width }));

  titleBlock(ws, [
    { text: orgName, size: 15, bold: true, color: ACCENT },
    { text: `${projectName} — ${estimate.name}`, size: 11, bold: true },
    { text: `Cost Estimate — Detail   ·   Generated ${today}`, size: 9, color: "FF64748B" },
  ]);

  const headerRowNum = headerRow(ws);
  ws.views = [{ state: "frozen", ySplit: headerRowNum }];

  const categorySubtotals: CategorySubtotal[] = [];

  for (const cat of CATEGORIES) {
    const primaries = items.filter((i) => i.scope_category === cat.key && i.type === "primary" && !i.parent_item_id);
    const sectionConsumables = items.filter((i) => i.scope_category === cat.key && i.type === "consumable" && !i.parent_item_id);
    if (primaries.length === 0 && sectionConsumables.length === 0) continue;

    categoryBandRow(ws, cat.label);
    const rangeStart = ws.rowCount;
    let catMat = 0;
    let catLab = 0;

    for (const primary of primaries) {
      itemRow(ws, primary, ws.rowCount + 1);
      catMat += itemMatCost(primary);
      catLab += itemLabCost(primary);
      const children = items
        .filter((c) => c.parent_item_id === primary.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const child of children) {
        itemRow(ws, child, ws.rowCount + 1, { indent: true });
        catMat += itemMatCost(child);
        catLab += itemLabCost(child);
      }
    }

    if (sectionConsumables.length > 0) {
      subBandRow(ws, "Section Prep (consolidated)");
      for (const sc of sectionConsumables.sort((a, b) => a.sort_order - b.sort_order)) {
        itemRow(ws, sc, ws.rowCount + 1, { indent: true });
        catMat += itemMatCost(sc);
        catLab += itemLabCost(sc);
      }
    }

    const rangeEnd = ws.rowCount;
    const subRow = subtotalRow(ws, `${cat.label} subtotal`, catMat, catLab, { start: rangeStart, end: rangeEnd });
    ws.addRow([]);
    categorySubtotals.push({ key: cat.key, label: cat.label, row: subRow.number, mat: catMat, lab: catLab });
  }

  let wetAreasTotalRow: number | null = null;
  if (wetAreas.length > 0) {
    categoryBandRow(ws, "Wet Areas");
    const waRow: Row = ws.addRow(["", "Name", "Qty", "Floor m²", "Wall Semi m²", "Wall Full m²", "Coving lm", "Labour $", "Charge $", "Profit $"]);
    waRow.eachCell((cell: Cell) => { cell.font = { bold: true, size: 9, color: { argb: "FF64748B" } }; });
    const waStart = ws.rowCount + 1;
    let waLab = 0;
    let waCharge = 0;
    for (const wa of wetAreas) {
      const labor = computeWetAreaLabor(wa) * (Number(wa.qty) || 1);
      const charge = (Number(wa.charge) || 0) * (Number(wa.qty) || 1);
      const rowNum = ws.rowCount + 1;
      const row: Row = ws.addRow(["", wa.name, wa.qty, wa.floor_sqm, wa.wall_semi_sqm, wa.wall_full_sqm, wa.coving_lm, labor, charge]);
      row.getCell(10).value = { formula: `I${rowNum}-H${rowNum}`, result: charge - labor };
      [8, 9, 10].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
      waLab += labor;
      waCharge += charge;
    }
    const waEnd = ws.rowCount;
    const totalRowNum = waEnd + 1;
    const totalRow: Row = ws.addRow(["", "Wet areas total"]);
    totalRow.getCell(8).value = { formula: `SUM(H${waStart}:H${waEnd})`, result: waLab };
    totalRow.getCell(9).value = { formula: `SUM(I${waStart}:I${waEnd})`, result: waCharge };
    totalRow.getCell(10).value = { formula: `I${totalRowNum}-H${totalRowNum}`, result: waCharge - waLab };
    totalRow.eachCell((cell: Cell) => { cell.font = { bold: true, size: 9.5 }; cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } }; });
    [8, 9, 10].forEach((c) => (totalRow.getCell(c).numFmt = CURRENCY_FMT));
    ws.addRow([]);
    wetAreasTotalRow = totalRowNum;
  }

  // Grand items subtotal — sums each category subtotal row individually
  // (not a contiguous range) so the Wet Areas block never gets double-counted.
  const grandMat = categorySubtotals.reduce((s, c) => s + c.mat, 0);
  const grandLab = categorySubtotals.reduce((s, c) => s + c.lab, 0);
  const grandRow: Row = ws.addRow(["ITEMS SUBTOTAL (before overhead, markup & GST)"]);
  const grandRowNum = grandRow.number;
  if (categorySubtotals.length > 0) {
    const matCells = categorySubtotals.map((c) => `I${c.row}`).join(",");
    const labCells = categorySubtotals.map((c) => `J${c.row}`).join(",");
    grandRow.getCell(9).value = { formula: `SUM(${matCells})`, result: grandMat };
    grandRow.getCell(10).value = { formula: `SUM(${labCells})`, result: grandLab };
  } else {
    grandRow.getCell(9).value = 0;
    grandRow.getCell(10).value = 0;
  }
  grandRow.getCell(11).value = { formula: `I${grandRowNum}+J${grandRowNum}`, result: grandMat + grandLab };
  ws.mergeCells(`A${grandRowNum}:H${grandRowNum}`);
  grandRow.eachCell((cell: Cell) => {
    cell.font = { bold: true, size: 10.5, color: { argb: SLATE_DARK } };
    cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
  });
  [9, 10, 11].forEach((c) => (grandRow.getCell(c).numFmt = CURRENCY_FMT));

  return { categorySubtotals, wetAreasTotalRow, itemsSubtotalRow: grandRowNum };
}

function labelValueRow(ws: Sheet, label: string, value: CellInput, opts: { fmt?: string; bold?: boolean; fill?: string; size?: number; topBorder?: boolean } = {}) {
  const row: Row = ws.addRow([label]);
  row.getCell(2).value = value;
  row.getCell(1).font = { bold: !!opts.bold, size: opts.size ?? 10 };
  row.getCell(2).font = { bold: !!opts.bold, size: opts.size ?? 10 };
  row.getCell(2).numFmt = opts.fmt ?? CURRENCY_FMT;
  row.getCell(2).alignment = { horizontal: "right" };
  if (opts.fill) {
    [1, 2].forEach((c) => (row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill! } }));
  }
  if (opts.topBorder) {
    [1, 2].forEach((c) => (row.getCell(c).border = { top: { style: "thin", color: { argb: BORDER_GREY } } }));
  }
  return row;
}

function buildSummarySheet(
  ws: Sheet,
  orgName: string,
  projectName: string,
  estimate: Estimate,
  items: EstimateItem[],
  wetAreas: WetArea[],
  today: string,
  detail: DetailResult
) {
  ws.columns = [{ width: 40 }, { width: 18 }];

  titleBlock(ws, [
    { text: orgName, size: 15, bold: true, color: ACCENT },
    { text: `${projectName} — ${estimate.name}`, size: 11, bold: true },
    { text: `Cost Estimate — Summary   ·   Generated ${today}`, size: 9, color: "FF64748B" },
  ]);

  // Category totals — pulled live from the Detail sheet's category subtotal rows
  const catHeaderRow: Row = ws.addRow(["Category", "Mat $", "Lab $", "Total $"]);
  catHeaderRow.eachCell((cell: Cell) => {
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
  });
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;

  const firstCatRow = catHeaderRow.number + 1;
  for (const c of detail.categorySubtotals) {
    const row: Row = ws.addRow([c.label]);
    row.getCell(2).value = { formula: `Detail!I${c.row}`, result: c.mat };
    row.getCell(3).value = { formula: `Detail!J${c.row}`, result: c.lab };
    row.getCell(4).value = { formula: `B${row.number}+C${row.number}`, result: c.mat + c.lab };
    [2, 3, 4].forEach((col) => (row.getCell(col).numFmt = CURRENCY_FMT));
  }
  const lastCatRow = firstCatRow + detail.categorySubtotals.length - 1;
  const baseMat = detail.categorySubtotals.reduce((s, c) => s + c.mat, 0);
  const baseLab = detail.categorySubtotals.reduce((s, c) => s + c.lab, 0);

  const catTotalRow: Row = ws.addRow(["Items total"]);
  if (detail.categorySubtotals.length > 0) {
    catTotalRow.getCell(2).value = { formula: `SUM(B${firstCatRow}:B${lastCatRow})`, result: baseMat };
    catTotalRow.getCell(3).value = { formula: `SUM(C${firstCatRow}:C${lastCatRow})`, result: baseLab };
  } else {
    catTotalRow.getCell(2).value = 0;
    catTotalRow.getCell(3).value = 0;
  }
  catTotalRow.getCell(4).value = { formula: `B${catTotalRow.number}+C${catTotalRow.number}`, result: baseMat + baseLab };
  catTotalRow.eachCell((cell: Cell) => { cell.font = { bold: true }; cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } }; });
  [2, 3, 4].forEach((c) => (catTotalRow.getCell(c).numFmt = CURRENCY_FMT));
  ws.addRow([]);
  ws.addRow([]);

  // P&L breakdown
  const s = computeSummary(items, estimate, wetAreas);
  const pnlHeader: Row = ws.addRow(["Cost Build-Up"]);
  ws.mergeCells(`A${pnlHeader.number}:D${pnlHeader.number}`);
  pnlHeader.getCell(1).font = { bold: true, size: 11, color: { argb: ACCENT } };

  const matRow = labelValueRow(ws, "Material cost", { formula: `B${catTotalRow.number}`, result: baseMat });
  const wetTerm = detail.wetAreasTotalRow ? `+Detail!J${detail.wetAreasTotalRow}` : "";
  const labRow = labelValueRow(ws, "Labour cost", { formula: `C${catTotalRow.number}${wetTerm}`, result: baseLab + s.wetAreasProfit });
  const accRow = labelValueRow(
    ws,
    `Accounting cost (${(estimate.accounting_rate * 100).toFixed(2)}%)`,
    { formula: `(B${matRow.number}+B${labRow.number})*${estimate.accounting_rate}`, result: s.accountingCost }
  );
  const adminRow = labelValueRow(
    ws,
    `Admin cost (${(estimate.admin_rate * 100).toFixed(2)}%)`,
    { formula: `(B${matRow.number}+B${labRow.number})*${estimate.admin_rate}`, result: s.adminCost }
  );
  const overheadRow = labelValueRow(
    ws,
    "Subtotal after overhead",
    { formula: `B${matRow.number}+B${labRow.number}+B${accRow.number}+B${adminRow.number}`, result: s.subtotalAfterOverhead },
    { bold: true, topBorder: true }
  );
  const markupRow = labelValueRow(
    ws,
    `Net markup (${(estimate.net_markup_pct * 100).toFixed(2)}%)`,
    { formula: `B${overheadRow.number}*${estimate.net_markup_pct}`, result: s.markupAmount }
  );

  const floorPrepProfitRow = s.floorPrepBags > 0 ? labelValueRow(ws, "Floor prep profit", s.floorPrepProfit) : null;
  const grindProfitRow = s.grindRevenue > 0 ? labelValueRow(ws, "Grinding profit", s.grindProfit) : null;

  const afterMarkupTerms = [`B${overheadRow.number}`, `B${markupRow.number}`];
  if (floorPrepProfitRow) afterMarkupTerms.push(`B${floorPrepProfitRow.number}`);
  if (grindProfitRow) afterMarkupTerms.push(`B${grindProfitRow.number}`);
  const afterMarkupRow = labelValueRow(
    ws,
    "Subtotal after markup",
    { formula: afterMarkupTerms.join("+"), result: s.subtotalAfterMarkup },
    { bold: true, topBorder: true }
  );

  const addCostsRow = s.additionalCosts > 0 ? labelValueRow(ws, "Additional costs (freight / accom. / travel / bailing)", s.additionalCosts) : null;
  const floorPrepCostRow = s.floorPrepCost > 0 ? labelValueRow(ws, "Floor prep cost recovery", s.floorPrepCost) : null;
  const grindCostRow = s.grindCost > 0 ? labelValueRow(ws, "Grinding cost recovery", s.grindCost) : null;

  const exGstTerms = [`B${afterMarkupRow.number}`];
  if (addCostsRow) exGstTerms.push(`B${addCostsRow.number}`);
  if (floorPrepCostRow) exGstTerms.push(`B${floorPrepCostRow.number}`);
  if (grindCostRow) exGstTerms.push(`B${grindCostRow.number}`);
  const exGstRow = labelValueRow(
    ws,
    "Total (ex GST)",
    { formula: exGstTerms.join("+"), result: s.totalExGst },
    { bold: true, size: 13, fill: ACCENT_LIGHT, topBorder: true }
  );
  const gstRow = labelValueRow(ws, "GST (10%)", { formula: `B${exGstRow.number}*0.1`, result: s.gst });
  labelValueRow(
    ws,
    "GRAND TOTAL",
    { formula: `B${exGstRow.number}+B${gstRow.number}`, result: s.grandTotal },
    { bold: true, size: 13, fill: ACCENT_LIGHT, topBorder: true }
  );

  const marginTerms = [`B${markupRow.number}`];
  if (floorPrepProfitRow) marginTerms.push(`B${floorPrepProfitRow.number}`);
  if (grindProfitRow) marginTerms.push(`B${grindProfitRow.number}`);
  labelValueRow(
    ws,
    "Gross margin",
    { formula: `(${marginTerms.join("+")})/B${exGstRow.number}`, result: s.grossMarginPct },
    { fmt: PCT_FRACTION_FMT }
  );
}

export async function exportEstimateExcel({
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
}): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = orgName;
  wb.created = new Date();

  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const detailSheet = wb.addWorksheet("Detail");
  const detailResult = buildDetailSheet(detailSheet, orgName, projectName, estimate, items, wetAreas, today);

  const summarySheet = wb.addWorksheet("Summary");
  buildSummarySheet(summarySheet, orgName, projectName, estimate, items, wetAreas, today, detailResult);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = `${sanitizeFilename(`${projectName} - ${estimate.name} - Cost Estimate`)}.xlsx`;
  downloadBlob(blob, filename);
}
