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

function itemRow(ws: Sheet, item: EstimateItem, opts: { indent?: boolean } = {}) {
  const effQty = itemMatQty(item);
  const matCost = itemMatCost(item);
  const labCost = itemLabCost(item);
  const row: Row = ws.addRow([
    item.finish_code ?? "",
    item.description ?? "",
    item.qty,
    item.unit,
    item.waste_pct,
    effQty,
    item.mat_rate,
    item.lab_rate,
    matCost,
    labCost,
    itemTotal(item),
  ]);
  row.getCell(2).alignment = { indent: opts.indent ? 2 : 0 };
  row.getCell(2).font = { bold: !opts.indent, color: { argb: opts.indent ? "FF64748B" : SLATE_DARK }, size: opts.indent ? 9.5 : 10 };
  [3, 6].forEach((c) => (row.getCell(c).numFmt = QTY_FMT));
  row.getCell(5).numFmt = PCT_100_FMT;
  [7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
  return row;
}

function subtotalRow(ws: Sheet, label: string, matSum: number, labSum: number) {
  const row: Row = ws.addRow([label, "", "", "", "", "", "", "", matSum, labSum, matSum + labSum]);
  ws.mergeCells(`A${row.number}:H${row.number}`);
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, size: 9.5, color: { argb: SLATE_DARK } };
    cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
  });
  [9, 10, 11].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
  return row;
}

function buildDetailSheet(ws: Sheet, orgName: string, projectName: string, estimate: Estimate, items: EstimateItem[], wetAreas: WetArea[], today: string) {
  ws.columns = DETAIL_COLS.map((c) => ({ width: c.width }));

  titleBlock(ws, [
    { text: orgName, size: 15, bold: true, color: ACCENT },
    { text: `${projectName} — ${estimate.name}`, size: 11, bold: true },
    { text: `Cost Estimate — Detail   ·   Generated ${today}`, size: 9, color: "FF64748B" },
  ]);

  const headerRowNum = headerRow(ws);
  ws.views = [{ state: "frozen", ySplit: headerRowNum }];

  let grandMat = 0;
  let grandLab = 0;

  for (const cat of CATEGORIES) {
    const primaries = items.filter((i) => i.scope_category === cat.key && i.type === "primary" && !i.parent_item_id);
    const sectionConsumables = items.filter((i) => i.scope_category === cat.key && i.type === "consumable" && !i.parent_item_id);
    if (primaries.length === 0 && sectionConsumables.length === 0) continue;

    categoryBandRow(ws, cat.label);
    let catMat = 0;
    let catLab = 0;

    for (const primary of primaries) {
      itemRow(ws, primary);
      catMat += itemMatCost(primary);
      catLab += itemLabCost(primary);
      const children = items
        .filter((c) => c.parent_item_id === primary.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const child of children) {
        itemRow(ws, child, { indent: true });
        catMat += itemMatCost(child);
        catLab += itemLabCost(child);
      }
    }

    if (sectionConsumables.length > 0) {
      subBandRow(ws, "Section Prep (consolidated)");
      for (const sc of sectionConsumables.sort((a, b) => a.sort_order - b.sort_order)) {
        itemRow(ws, sc, { indent: true });
        catMat += itemMatCost(sc);
        catLab += itemLabCost(sc);
      }
    }

    subtotalRow(ws, `${cat.label} subtotal`, catMat, catLab);
    ws.addRow([]);
    grandMat += catMat;
    grandLab += catLab;
  }

  if (wetAreas.length > 0) {
    categoryBandRow(ws, "Wet Areas");
    const waRow: Row = ws.addRow(["", "Name", "Qty", "Floor m²", "Wall Semi m²", "Wall Full m²", "Coving lm", "Labour $", "Charge $", "Profit $"]);
    waRow.eachCell((cell: Cell) => { cell.font = { bold: true, size: 9, color: { argb: "FF64748B" } }; });
    let waLab = 0;
    let waCharge = 0;
    for (const wa of wetAreas) {
      const labor = computeWetAreaLabor(wa) * (Number(wa.qty) || 1);
      const charge = (Number(wa.charge) || 0) * (Number(wa.qty) || 1);
      const row: Row = ws.addRow(["", wa.name, wa.qty, wa.floor_sqm, wa.wall_semi_sqm, wa.wall_full_sqm, wa.coving_lm, labor, charge, charge - labor]);
      [8, 9, 10].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
      waLab += labor;
      waCharge += charge;
    }
    const totalRow: Row = ws.addRow(["", "Wet areas total", "", "", "", "", "", waLab, waCharge, waCharge - waLab]);
    totalRow.eachCell((cell: Cell) => { cell.font = { bold: true, size: 9.5 }; cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } }; });
    [8, 9, 10].forEach((c) => (totalRow.getCell(c).numFmt = CURRENCY_FMT));
    ws.addRow([]);
  }

  const grandRow = subtotalRow(ws, "ITEMS SUBTOTAL (before overhead, markup & GST)", grandMat, grandLab);
  grandRow.eachCell((cell: Cell) => { cell.font = { bold: true, size: 10.5 }; });
}

function labelValueRow(ws: Sheet, label: string, value: number, opts: { fmt?: string; bold?: boolean; fill?: string; size?: number; topBorder?: boolean } = {}) {
  const row: Row = ws.addRow([label, value]);
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

function buildSummarySheet(ws: Sheet, orgName: string, projectName: string, estimate: Estimate, items: EstimateItem[], wetAreas: WetArea[], today: string) {
  ws.columns = [{ width: 40 }, { width: 18 }];

  titleBlock(ws, [
    { text: orgName, size: 15, bold: true, color: ACCENT },
    { text: `${projectName} — ${estimate.name}`, size: 11, bold: true },
    { text: `Cost Estimate — Summary   ·   Generated ${today}`, size: 9, color: "FF64748B" },
  ]);

  // Category totals
  const catHeaderRow: Row = ws.addRow(["Category", "Mat $", "Lab $", "Total $"]);
  ws.mergeCells(`A${catHeaderRow.number}:A${catHeaderRow.number}`);
  catHeaderRow.eachCell((cell: Cell) => {
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
  });
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;

  let baseMat = 0;
  let baseLab = 0;
  for (const cat of CATEGORIES) {
    const catItems = items.filter((i) => i.scope_category === cat.key);
    if (catItems.length === 0) continue;
    const mat = catItems.reduce((s, i) => s + itemMatCost(i), 0);
    const lab = catItems.reduce((s, i) => s + itemLabCost(i), 0);
    const row: Row = ws.addRow([cat.label, mat, lab, mat + lab]);
    [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
    baseMat += mat;
    baseLab += lab;
  }
  const catTotalRow: Row = ws.addRow(["Items total", baseMat, baseLab, baseMat + baseLab]);
  catTotalRow.eachCell((cell: Cell) => { cell.font = { bold: true }; cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } }; });
  [2, 3, 4].forEach((c) => (catTotalRow.getCell(c).numFmt = CURRENCY_FMT));
  ws.addRow([]);
  ws.addRow([]);

  // P&L breakdown
  const s = computeSummary(items, estimate, wetAreas);
  const pnlHeader: Row = ws.addRow(["Cost Build-Up"]);
  ws.mergeCells(`A${pnlHeader.number}:D${pnlHeader.number}`);
  pnlHeader.getCell(1).font = { bold: true, size: 11, color: { argb: ACCENT } };

  labelValueRow(ws, "Base cost (materials + labour)", s.base);
  labelValueRow(ws, `Accounting cost (${(estimate.accounting_rate * 100).toFixed(2)}%)`, s.accountingCost);
  labelValueRow(ws, `Admin cost (${(estimate.admin_rate * 100).toFixed(2)}%)`, s.adminCost);
  labelValueRow(ws, "Subtotal after overhead", s.subtotalAfterOverhead, { bold: true, topBorder: true });
  labelValueRow(ws, `Net markup (${(estimate.net_markup_pct * 100).toFixed(2)}%)`, s.markupAmount);
  if (s.floorPrepBags > 0) labelValueRow(ws, "Floor prep profit", s.floorPrepProfit);
  if (s.grindRevenue > 0) labelValueRow(ws, "Grinding profit", s.grindProfit);
  labelValueRow(ws, "Subtotal after markup", s.subtotalAfterMarkup, { bold: true, topBorder: true });
  if (s.additionalCosts > 0) labelValueRow(ws, "Additional costs (freight / accom. / travel / bailing)", s.additionalCosts);
  if (s.floorPrepCost > 0) labelValueRow(ws, "Floor prep cost recovery", s.floorPrepCost);
  if (s.grindCost > 0) labelValueRow(ws, "Grinding cost recovery", s.grindCost);
  labelValueRow(ws, "Total (ex GST)", s.totalExGst, { bold: true, size: 13, fill: ACCENT_LIGHT, topBorder: true });
  labelValueRow(ws, "GST (10%)", s.gst);
  labelValueRow(ws, "GRAND TOTAL", s.grandTotal, { bold: true, size: 13, fill: ACCENT_LIGHT, topBorder: true });
  labelValueRow(ws, "Gross margin", s.grossMarginPct, { fmt: PCT_FRACTION_FMT });
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
  buildDetailSheet(detailSheet, orgName, projectName, estimate, items, wetAreas, today);

  const summarySheet = wb.addWorksheet("Summary");
  buildSummarySheet(summarySheet, orgName, projectName, estimate, items, wetAreas, today);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = `${sanitizeFilename(`${projectName} - ${estimate.name} - Cost Estimate`)}.xlsx`;
  downloadBlob(blob, filename);
}
