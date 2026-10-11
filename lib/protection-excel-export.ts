import type { Cell, CellValue, Row } from "exceljs";
import {
  ACCENT,
  ACCENT_LIGHT,
  SLATE_DARK,
  SLATE_LIGHT,
  BORDER_GREY,
  CURRENCY_FMT,
  QTY_FMT,
  sanitizeFilename,
  downloadBlob,
  titleBlock,
  bandRow,
  type Sheet,
} from "@/lib/excel-shared";
import { computeEstimate, computeLine } from "@/lib/corner-guard-calc";
import type { CornerGuardDefaults, CornerGuardLine, LineResult } from "@/lib/corner-guard-calc";
import { computeWallPanelLine, computeWallPanels, computeWeldRod } from "@/lib/wall-panel-calc";
import type { WallPanelDefaults, WallPanelLine, WallPanelLineResult, WeldRodLine } from "@/lib/wall-panel-calc";
import { computeDoorPanelLine, computeDoorPanels } from "@/lib/door-panel-calc";
import type { DoorPanelLine } from "@/lib/door-panel-calc";
import { computeRailLine, computeRails } from "@/lib/rail-calc";
import type { RailDefaults, RailLine } from "@/lib/rail-calc";
import { computeCostingSummary, GST_RATE } from "@/lib/protection-summary";
import type { CostingInputs, TradeSubtotal } from "@/lib/protection-summary";

// Wall & Door Protection estimate → a self-contained workbook that rebuilds the whole
// costing with live formulas (lib/*-calc.ts and lib/protection-summary.ts, cell for cell).
// Every formula carries the app's figure as its cached result, so the file shows the
// right numbers before Excel recalculates.
//
// Colour code (explained on the Summary sheet):
//   blue cell  = an input — type over it
//   green text = linked to the job default above the table — type a number to override it
//   grey cell  = a formula
// Percentages are stored as fractions (10% = 0.1) so they can be typed as "10%".

const INPUT_FONT = "FF1D4ED8";
const INPUT_FILL = "FFEFF6FF";
const LINK_FONT = "FF15803D";
const MUTED = "FF64748B";
const FLAG_FILL = "FFFDE68A";
const INT_FMT = "#,##0";
const PCT_FMT = "0.0%";
const PCT2_FMT = "0.00%";
const M2_FMT = "0.000";

type Kind = "input" | "link" | "calc" | "text";
type Spec = { v: CellValue; kind: Kind };

const text = (v: string | null): Spec => ({ v: v ?? null, kind: "text" });
const input = (v: number | string | null): Spec => ({ v: v ?? null, kind: "input" });
const calc = (formula: string, result: number | string | null): Spec => ({
  v: { formula, result: result ?? "" },
  kind: "calc",
});
/** A line value that falls back to a default: typed-in values stay, null becomes a live link. */
const inherit = (own: number | string | null, ref: string, fallback: number | string | null): Spec =>
  own !== null ? input(own) : { v: { formula: ref, result: fallback ?? 0 }, kind: "link" };

const yesNo = (b: boolean) => (b ? "Yes" : "No");
const pct = (n: number | null) => (n === null ? null : n / 100);

function numericResult(v: CellValue): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  return 0;
}

function colLetter(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function styleCell(cell: Cell, kind: Kind, fmt?: string) {
  if (fmt) cell.numFmt = fmt;
  cell.border = { bottom: { style: "hair", color: { argb: BORDER_GREY } } };
  if (kind === "input") {
    cell.font = { color: { argb: INPUT_FONT }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
  } else if (kind === "link") {
    cell.font = { color: { argb: LINK_FONT }, size: 10 };
  } else if (kind === "calc") {
    cell.font = { color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_LIGHT } };
  } else {
    cell.font = { color: { argb: SLATE_DARK }, size: 10 };
  }
}

function setWidth(ws: Sheet, col: number, width: number) {
  const c = ws.getColumn(col);
  c.width = Math.max(c.width ?? 0, width);
}

function sheetSetup(ws: Sheet) {
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.properties.defaultRowHeight = 16;
}

// ── Line tables ───────────────────────────────────────────────────────────────

type Col<L> = {
  key: string;
  header: string;
  width: number;
  fmt?: string;
  /** Show a SUM in the totals row */
  sum?: boolean;
  yesNo?: boolean;
  cell: (l: L, ref: (key: string) => string) => Spec;
};

type TableOut = {
  /** Column letter of a key */
  col: (key: string) => string;
  first: number;
  last: number;
  totalRow: number;
};

/**
 * Header + one row per line + a totals row. `flag` adds a live amber highlight to a column
 * (e.g. an install rate of 0 on a line that has quantity — the app blocks those totals).
 */
function lineTable<L>(
  ws: Sheet,
  cols: Col<L>[],
  lines: L[],
  opts: { startCol?: number; totalLabel: string; flag?: { key: string; when: (ref: (key: string) => string) => string } }
): TableOut {
  const start = opts.startCol ?? 1;
  const letters = new Map(cols.map((c, i) => [c.key, colLetter(start + i)]));
  const col = (key: string) => letters.get(key)!;
  cols.forEach((c, i) => setWidth(ws, start + i, c.width));

  const header: Row = ws.getRow(ws.rowCount + 1);
  cols.forEach((c, i) => {
    const cell = header.getCell(start + i);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 9.5 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_GREY } } };
    cell.alignment = { vertical: "middle", wrapText: true, horizontal: c.fmt ? "right" : "left" };
  });
  header.height = 30;

  const first = header.number + 1;
  const sums = new Map<string, number>();
  lines.forEach((l, idx) => {
    const r = first + idx;
    const ref = (key: string) => `${col(key)}${r}`;
    const row = ws.getRow(r);
    cols.forEach((c, i) => {
      const spec = c.cell(l, ref);
      const cell = row.getCell(start + i);
      cell.value = spec.v;
      styleCell(cell, spec.kind, c.fmt);
      if (c.yesNo) {
        cell.dataValidation = { type: "list", allowBlank: false, formulae: ['"Yes,No"'] };
        cell.alignment = { horizontal: "center" };
      }
      if (c.sum) sums.set(c.key, (sums.get(c.key) ?? 0) + numericResult(spec.v));
    });
  });
  const last = first + lines.length - 1;

  const totalRow: Row = ws.getRow(last + 1);
  totalRow.getCell(start).value = opts.totalLabel;
  cols.forEach((c, i) => {
    const cell = totalRow.getCell(start + i);
    if (c.sum) {
      cell.value = { formula: `SUM(${col(c.key)}${first}:${col(c.key)}${last})`, result: sums.get(c.key) ?? 0 };
      cell.numFmt = c.fmt ?? QTY_FMT;
    }
    cell.font = { bold: true, color: { argb: SLATE_DARK }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
    cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
  });

  if (opts.flag) {
    const firstRef = (key: string) => `${col(key)}${first}`;
    const c = col(opts.flag.key);
    ws.addConditionalFormatting({
      ref: `${c}${first}:${c}${last}`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [opts.flag.when(firstRef)],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: FLAG_FILL } } },
        },
      ],
    });
  }

  return { col, first, last, totalRow: totalRow.number };
}

// ── Job defaults block ────────────────────────────────────────────────────────

type DefaultItem = { label: string; value: number | string | null; fmt?: string; note?: string; yesNo?: boolean };

/** Label (A:B merged) · input (C) · note (D). Returns the absolute ref of each input. */
function defaultsBlock(ws: Sheet, lastColLetter: string, title: string, items: DefaultItem[]): string[] {
  bandRow(ws, lastColLetter, title, { fill: SLATE_LIGHT, textColor: MUTED, size: 9.5 });
  return items.map((it) => {
    const row: Row = ws.addRow([it.label, null, it.value ?? null, it.note ?? null]);
    ws.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell(1).font = { color: { argb: SLATE_DARK }, size: 10 };
    styleCell(row.getCell(3), "input", it.fmt);
    if (it.yesNo) {
      row.getCell(3).dataValidation = { type: "list", allowBlank: false, formulae: ['"Yes,No"'] };
      row.getCell(3).alignment = { horizontal: "center" };
    }
    row.getCell(4).font = { italic: true, color: { argb: MUTED }, size: 9 };
    return `$C$${row.number}`;
  });
}

/** Full-width purple band with the trade total in `valueCol`. Returns the cross-sheet ref. */
function totalBand(ws: Sheet, lastCol: number, label: string, valueCol: number, formula: string, result: number) {
  const row: Row = ws.addRow([]);
  row.getCell(1).value = label;
  row.getCell(valueCol).value = { formula, result };
  row.getCell(valueCol).numFmt = CURRENCY_FMT;
  for (let c = 1; c <= lastCol; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
  }
  row.height = 20;
  return `${quoteSheet(ws.name)}!$${colLetter(valueCol)}$${row.number}`;
}

function sheetTitle(ws: Sheet, lastColLetter: string, title: string, subtitle: string, how: string[]) {
  titleBlock(ws, lastColLetter, [
    { text: title, size: 15, bold: true },
    { text: subtitle, size: 10, color: MUTED },
    ...how.map((t) => ({ text: t, size: 9, color: MUTED })),
  ]);
}

/** Empty trades get a few blank, fully formulated rows so the sheet can still be filled in. */
const BLANK_ROWS = 3;

// ── Corner guards ─────────────────────────────────────────────────────────────

function cornerGuardSheet(ws: Sheet, subtitle: string, d: CornerGuardDefaults, lines: CornerGuardLine[]) {
  const LAST = "S";
  sheetTitle(ws, LAST, "Corner guards", subtitle, [
    "Material = qty × $ each (standard and nib) · Install = (standard + nib) × install $ · Cutting = cuts × cut $ when cutting is Yes.",
    "Corner guards total = all line totals + sundries (builders mastic, silicone).",
  ]);
  const [pStd, pNib, inst, coving, cutOn, cutRate] = defaultsBlock(ws, LAST, "JOB DEFAULTS — used by every line that shows green", [
    { label: "Standard guard — $ each", value: d.default_price_std, fmt: CURRENCY_FMT },
    { label: "Nib guard — $ each", value: d.default_price_nib, fmt: CURRENCY_FMT },
    { label: "Install — $ per guard", value: d.default_install_rate, fmt: CURRENCY_FMT },
    { label: "Coving height (mm)", value: d.default_coving_mm, fmt: INT_FMT, note: "Guard height = wall height − coving" },
    { label: "Cutting", value: yesNo(d.cutting_enabled), yesNo: true },
    { label: "Cutting — $ per cut", value: d.default_cutting_rate, fmt: CURRENCY_FMT },
  ]);
  ws.addRow([]);
  bandRow(ws, LAST, "LINES");

  const rows: { l: CornerGuardLine; r: LineResult }[] = (lines.length ? lines : blankCornerGuards()).map((l) => ({
    l,
    r: computeLine(l, d),
  }));
  const t = lineTable<{ l: CornerGuardLine; r: LineResult }>(
    ws,
    [
      { key: "group", header: "Group", width: 24, cell: ({ l }) => text(l.group_name?.trim() || null) },
      { key: "desc", header: "Description", width: 30, cell: ({ l }) => text(l.description) },
      { key: "wall", header: "Wall height mm", width: 10, fmt: INT_FMT, cell: ({ l }) => input(l.wall_height_mm) },
      { key: "coving", header: "Coving mm", width: 10, fmt: INT_FMT, cell: ({ l }) => inherit(l.coving_mm, coving, d.default_coving_mm) },
      {
        key: "guard",
        header: "Guard height mm",
        width: 10,
        fmt: INT_FMT,
        cell: ({ r }, ref) => calc(`IF(${ref("wall")}="","",${ref("wall")}-${ref("coving")})`, r.guardHeight),
      },
      { key: "qStd", header: "Standard qty", width: 10, fmt: INT_FMT, sum: true, cell: ({ l }) => input(l.qty_std) },
      { key: "qNib", header: "Nib qty", width: 9, fmt: INT_FMT, sum: true, cell: ({ l }) => input(l.qty_nib) },
      { key: "pStd", header: "Standard $ each", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.price_std, pStd, d.default_price_std) },
      { key: "pNib", header: "Nib $ each", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.price_nib, pNib, d.default_price_nib) },
      { key: "inst", header: "Install $ each", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.install_rate, inst, d.default_install_rate) },
      {
        key: "cut",
        header: "Cutting",
        width: 8,
        yesNo: true,
        cell: ({ l }) => inherit(l.cutting_enabled === null ? null : yesNo(l.cutting_enabled), cutOn, yesNo(d.cutting_enabled)),
      },
      { key: "cuts", header: "Cuts", width: 7, fmt: INT_FMT, sum: true, cell: ({ l }) => input(l.cuts_qty) },
      { key: "cRate", header: "Cut $ each", width: 10, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.cutting_rate, cutRate, d.default_cutting_rate) },
      {
        key: "mStd",
        header: "Standard material",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("qStd")}*${ref("pStd")}`, r.materialStd),
      },
      {
        key: "mNib",
        header: "Nib material",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("qNib")}*${ref("pNib")}`, r.materialNib),
      },
      {
        key: "install",
        header: "Install",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`(${ref("qStd")}+${ref("qNib")})*${ref("inst")}`, r.installStd + r.installNib),
      },
      {
        key: "cutting",
        header: "Cutting $",
        width: 11,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`IF(${ref("cut")}="Yes",${ref("cuts")}*${ref("cRate")},0)`, r.cutting),
      },
      {
        key: "total",
        header: "Line total",
        width: 13,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("mStd")}+${ref("mNib")}+${ref("install")}+${ref("cutting")}`, r.total),
      },
      { key: "notes", header: "Notes", width: 28, cell: ({ l }) => text(l.notes) },
    ],
    rows,
    {
      totalLabel: "Lines subtotal",
      flag: { key: "inst", when: (ref) => `AND(${ref("qStd")}+${ref("qNib")}>0,${ref("inst")}=0)` },
    }
  );
  const totals = computeEstimate(lines, d);
  const totalCol = 18; // R — "Line total"
  ws.addRow([]);

  // Sundries — estimate-level qty × $ each
  bandRow(ws, LAST, "SUNDRIES", { fill: SLATE_LIGHT, textColor: MUTED, size: 9.5 });
  const sh: Row = ws.addRow(["", "", "Qty", "$ each"]);
  sh.getCell(totalCol).value = "Amount";
  [3, 4, totalCol].forEach((c) => {
    sh.getCell(c).font = { bold: true, color: { argb: MUTED }, size: 9 };
    sh.getCell(c).alignment = { horizontal: "right" };
  });
  const sundry = (label: string, qty: number, price: number | null, amount: number) => {
    const row: Row = ws.addRow([label, null, qty, price]);
    ws.mergeCells(`A${row.number}:B${row.number}`);
    styleCell(row.getCell(3), "input", QTY_FMT);
    styleCell(row.getCell(4), "input", CURRENCY_FMT);
    row.getCell(totalCol).value = { formula: `C${row.number}*D${row.number}`, result: amount };
    styleCell(row.getCell(totalCol), "calc", CURRENCY_FMT);
    return `R${row.number}`;
  };
  const mastic = sundry("Builders mastic", d.cg_mastic_qty, d.cg_mastic_price, totals.mastic);
  const silicone = sundry("Silicone", d.cg_silicone_qty, d.cg_silicone_price, totals.silicone);
  ws.addRow([]);

  const ref = totalBand(ws, 19, "CORNER GUARDS TOTAL", totalCol, `R${t.totalRow}+${mastic}+${silicone}`, totals.total);

  // Group subtotals (only when the lines are grouped)
  if (totals.groups.some((g) => g.name !== "")) {
    ws.addRow([]);
    bandRow(ws, LAST, "GROUP SUBTOTALS", { fill: SLATE_LIGHT, textColor: MUTED, size: 9.5 });
    const range = `$A$${t.first}:$A$${t.last}`;
    const sumRange = `$R$${t.first}:$R$${t.last}`;
    for (const g of totals.groups) {
      const row: Row = ws.addRow([g.name || "(No group)"]);
      ws.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(totalCol).value = {
        formula: `SUMIF(${range},${g.name ? `A${row.number}` : '""'},${sumRange})`,
        result: g.total,
      };
      styleCell(row.getCell(totalCol), "calc", CURRENCY_FMT);
    }
  }

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: t.first - 1 }];
  return ref;
}

function blankCornerGuards(): CornerGuardLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => ({
    id: `blank-${i}`,
    sort_order: i,
    group_name: null,
    description: null,
    wall_height_mm: null,
    coving_mm: null,
    qty_std: 0,
    qty_nib: 0,
    price_std: null,
    price_nib: null,
    install_rate: null,
    cutting_enabled: null,
    cuts_qty: 0,
    cutting_rate: null,
    notes: null,
  }));
}

// ── Wall panels ───────────────────────────────────────────────────────────────

function wallPanelSheet(ws: Sheet, subtitle: string, d: WallPanelDefaults, lines: WallPanelLine[], rods: WeldRodLine[]) {
  const LAST = "X";
  sheetTitle(ws, LAST, "Wall panels", subtitle, [
    "Base sheets = sheets override, else ROUNDUP(gross m² ÷ sheet m²) · Total sheets = ROUNDUP(base × (1 + wastage)).",
    "Material = total sheets × $ / sheet (includes wastage) · Install and glue = base sheets × rate (no wastage) · Cutouts = qty × $.",
    "Weld rods = qty × (1 + wastage) × unit cost + labour. Wall panels total = panel lines + weld rods.",
  ]);
  const [w, len, wst, price, inst, glue, cutRate] = defaultsBlock(ws, LAST, "JOB DEFAULTS — used by every line that shows green", [
    { label: "Sheet width (mm)", value: d.wp_sheet_width_mm, fmt: INT_FMT },
    { label: "Sheet length (mm)", value: d.wp_sheet_length_mm, fmt: INT_FMT },
    { label: "Wastage", value: pct(d.wp_wastage_pct), fmt: PCT_FMT, note: "Added to material only — never to labour" },
    { label: "Material — $ per sheet", value: d.wp_default_price, fmt: CURRENCY_FMT },
    { label: "Install — $ per sheet", value: d.wp_install_rate, fmt: CURRENCY_FMT },
    { label: "Glue — $ per sheet", value: d.wp_glue_rate, fmt: CURRENCY_FMT },
    { label: "Cutout — $ each", value: d.wp_cutout_rate, fmt: CURRENCY_FMT },
  ]);
  ws.addRow([]);
  bandRow(ws, LAST, "PANEL LINES");

  type R = { l: WallPanelLine; r: WallPanelLineResult };
  const rows: R[] = (lines.length ? lines : blankWallPanels()).map((l) => ({ l, r: computeWallPanelLine(l, d) }));
  const t = lineTable<R>(
    ws,
    [
      { key: "code", header: "Item code", width: 10, cell: ({ l }) => text(l.item_code) },
      { key: "product", header: "Product", width: 28, cell: ({ l }) => text(l.product) },
      { key: "gross", header: "Gross m²", width: 10, fmt: QTY_FMT, sum: true, cell: ({ l }) => input(l.gross_m2) },
      { key: "net", header: "Net m²", width: 10, fmt: QTY_FMT, sum: true, cell: ({ l }) => input(l.net_m2) },
      { key: "w", header: "Sheet width mm", width: 10, fmt: INT_FMT, cell: ({ l }) => inherit(l.sheet_width_mm, w, d.wp_sheet_width_mm) },
      { key: "len", header: "Sheet length mm", width: 10, fmt: INT_FMT, cell: ({ l }) => inherit(l.sheet_length_mm, len, d.wp_sheet_length_mm) },
      { key: "m2", header: "Sheet m²", width: 9, fmt: M2_FMT, cell: ({ r }, ref) => calc(`${ref("w")}*${ref("len")}/1000000`, r.sheetM2) },
      {
        key: "area",
        header: "Sheets by area",
        width: 9,
        fmt: INT_FMT,
        cell: ({ r }, ref) =>
          calc(`IF(OR(${ref("gross")}="",${ref("m2")}<=0),"",ROUNDUP(ROUND(${ref("gross")}/${ref("m2")},6),0))`, r.areaSheets),
      },
      { key: "ovr", header: "Sheets override", width: 9, fmt: INT_FMT, cell: ({ l }) => input(l.sheets_override) },
      {
        key: "base",
        header: "Base sheets",
        width: 9,
        fmt: INT_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`IF(${ref("ovr")}<>"",${ref("ovr")},IF(${ref("area")}="",0,${ref("area")}))`, r.baseSheets),
      },
      { key: "wst", header: "Wastage", width: 9, fmt: PCT_FMT, cell: ({ l }) => inherit(pct(l.wastage_pct), wst, pct(d.wp_wastage_pct)) },
      {
        key: "total_sh",
        header: "Total sheets",
        width: 9,
        fmt: INT_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`ROUNDUP(ROUND(${ref("base")}*(1+${ref("wst")}),6),0)`, r.totalSheets),
      },
      {
        key: "waste_sh",
        header: "Waste sheets",
        width: 9,
        fmt: INT_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("total_sh")}-${ref("base")}`, r.wasteSheets),
      },
      { key: "price", header: "$ / sheet", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.price, price, d.wp_default_price) },
      { key: "inst", header: "Install $ / sheet", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.install_rate, inst, d.wp_install_rate) },
      { key: "glue", header: "Glue $ / sheet", width: 11, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.glue_rate, glue, d.wp_glue_rate) },
      { key: "cuts", header: "Cutouts", width: 8, fmt: INT_FMT, sum: true, cell: ({ l }) => input(l.cutouts_qty) },
      { key: "cRate", header: "$ / cutout", width: 10, fmt: CURRENCY_FMT, cell: ({ l }) => inherit(l.cutout_rate, cutRate, d.wp_cutout_rate) },
      {
        key: "mat",
        header: "Material",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("total_sh")}*${ref("price")}`, r.material),
      },
      {
        key: "install",
        header: "Install",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("base")}*${ref("inst")}`, r.install),
      },
      {
        key: "glueC",
        header: "Glue",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("base")}*${ref("glue")}`, r.glue),
      },
      {
        key: "cutC",
        header: "Cutouts $",
        width: 11,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("cuts")}*${ref("cRate")}`, r.cutouts),
      },
      {
        key: "total",
        header: "Line total",
        width: 13,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: ({ r }, ref) => calc(`${ref("mat")}+${ref("install")}+${ref("glueC")}+${ref("cutC")}`, r.total),
      },
      { key: "notes", header: "Notes", width: 28, cell: ({ l }) => text(l.notes) },
    ],
    rows,
    { totalLabel: "Panels subtotal", flag: { key: "inst", when: (ref) => `AND(${ref("base")}>0,${ref("inst")}=0)` } }
  );
  ws.addRow([]);

  // Weld rods — own table under the panels, starting in column B
  bandRow(ws, LAST, "WELD RODS");
  const rodRows = rods.length ? rods : blankWeldRods();
  const rt = lineTable<WeldRodLine>(
    ws,
    [
      { key: "desc", header: "Description", width: 28, cell: (r) => text(r.description) },
      { key: "qty", header: "Qty", width: 10, fmt: QTY_FMT, sum: true, cell: (r) => input(r.qty) },
      { key: "unit", header: "Unit", width: 10, cell: (r) => input(r.unit) },
      { key: "cost", header: "Unit cost", width: 10, fmt: CURRENCY_FMT, cell: (r) => input(r.unit_cost) },
      { key: "wst", header: "Wastage", width: 10, fmt: PCT_FMT, cell: (r) => input(pct(r.wastage_pct)) },
      {
        key: "supply",
        header: "Supply",
        width: 9,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (r, ref) => calc(`${ref("qty")}*(1+${ref("wst")})*${ref("cost")}`, computeWeldRod(r).supply),
      },
      { key: "labour", header: "Labour", width: 9, fmt: CURRENCY_FMT, sum: true, cell: (r) => input(r.labour) },
      {
        key: "total",
        header: "Line total",
        width: 9,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (r, ref) => calc(`${ref("supply")}+${ref("labour")}`, computeWeldRod(r).total),
      },
      { key: "notes", header: "Notes", width: 9, cell: (r) => text(r.notes) },
    ],
    rodRows,
    { startCol: 2, totalLabel: "Weld rods subtotal" }
  );
  ws.addRow([]);

  const totals = computeWallPanels(lines, rods, d);
  const ref = totalBand(
    ws,
    24,
    "WALL PANELS TOTAL",
    23,
    `${t.col("total")}${t.totalRow}+${rt.col("total")}${rt.totalRow}`,
    totals.total
  );
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: t.first - 1 }];
  return ref;
}

function blankWallPanels(): WallPanelLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => ({
    id: `blank-${i}`,
    sort_order: i,
    item_code: null,
    product: null,
    gross_m2: null,
    net_m2: null,
    sheet_width_mm: null,
    sheet_length_mm: null,
    sheets_override: null,
    wastage_pct: null,
    price: null,
    install_rate: null,
    glue_rate: null,
    cutouts_qty: 0,
    cutout_rate: null,
    notes: null,
  }));
}

function blankWeldRods(): WeldRodLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => ({
    id: `blank-${i}`,
    sort_order: i,
    description: null,
    qty: 0,
    unit: null,
    unit_cost: null,
    wastage_pct: 0,
    labour: null,
    notes: null,
  }));
}

// ── Door panels ───────────────────────────────────────────────────────────────

function doorPanelSheet(ws: Sheet, subtitle: string, lines: DoorPanelLine[]) {
  const LAST = "O";
  sheetTitle(ws, LAST, "Door panels", subtitle, [
    "Every rate is typed per line (no job defaults). Material = sheets × $ / sheet · Install = panels × install $.",
    "Cutting = panels to cut × cut $ when Cut is Yes (panels to cut follows the panel qty unless typed over) · Glue = panels × glue $.",
  ]);
  bandRow(ws, LAST, "LINES");

  const rows = lines.length ? lines : blankDoorPanels();
  const t = lineTable<DoorPanelLine>(
    ws,
    [
      { key: "item", header: "Item", width: 30, cell: (l) => text(l.item) },
      { key: "sheets", header: "Sheets", width: 9, fmt: INT_FMT, sum: true, cell: (l) => input(l.sheets_qty) },
      { key: "price", header: "$ / sheet", width: 11, fmt: CURRENCY_FMT, cell: (l) => input(l.price) },
      {
        key: "mat",
        header: "Material",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`${ref("sheets")}*${ref("price")}`, computeDoorPanelLine(l).material),
      },
      { key: "panels", header: "Panels", width: 9, fmt: INT_FMT, sum: true, cell: (l) => input(l.panels_qty) },
      { key: "inst", header: "Install $ / panel", width: 11, fmt: CURRENCY_FMT, cell: (l) => input(l.install_rate) },
      { key: "cut", header: "Cut", width: 7, yesNo: true, cell: (l) => input(yesNo(l.cutting_enabled)) },
      {
        key: "cutQty",
        header: "Panels to cut",
        width: 9,
        fmt: INT_FMT,
        cell: (l, ref) => inherit(l.cut_qty, ref("panels"), l.panels_qty),
      },
      { key: "cRate", header: "Cut $ / panel", width: 11, fmt: CURRENCY_FMT, cell: (l) => input(l.cutting_rate) },
      { key: "glue", header: "Glue $ / panel", width: 11, fmt: CURRENCY_FMT, cell: (l) => input(l.glue_rate) },
      {
        key: "install",
        header: "Install",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`${ref("panels")}*${ref("inst")}`, l.panels_qty * (l.install_rate ?? 0)),
      },
      {
        key: "cutting",
        header: "Cutting",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`IF(${ref("cut")}="Yes",${ref("cutQty")}*${ref("cRate")},0)`, computeDoorPanelLine(l).cutting),
      },
      {
        key: "glueC",
        header: "Glue",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`${ref("panels")}*${ref("glue")}`, computeDoorPanelLine(l).glue),
      },
      {
        key: "total",
        header: "Line total",
        width: 13,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) =>
          calc(`${ref("mat")}+${ref("install")}+${ref("cutting")}+${ref("glueC")}`, computeDoorPanelLine(l).total),
      },
      { key: "notes", header: "Notes", width: 28, cell: (l) => text(l.notes) },
    ],
    rows,
    { totalLabel: "Lines subtotal", flag: { key: "inst", when: (ref) => `AND(${ref("panels")}>0,${ref("inst")}=0)` } }
  );
  ws.addRow([]);
  const ref = totalBand(ws, 15, "DOOR PANELS TOTAL", 14, `${t.col("total")}${t.totalRow}`, computeDoorPanels(lines).total);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: t.first - 1 }];
  return ref;
}

function blankDoorPanels(): DoorPanelLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => ({
    id: `blank-${i}`,
    sort_order: i,
    item: null,
    sheets_qty: 0,
    price: null,
    panels_qty: 0,
    install_rate: null,
    cutting_enabled: false,
    cut_qty: null,
    cutting_rate: null,
    glue_rate: null,
    notes: null,
  }));
}

// ── Crash rail / handrails ────────────────────────────────────────────────────

function railSheet(ws: Sheet, title: string, subtitle: string, d: RailDefaults, lines: RailLine[], showReturns: boolean) {
  const lastCol = showReturns ? 15 : 13;
  const LAST = colLetter(lastCol);
  sheetTitle(ws, LAST, title, subtitle, [
    "Order lm follows the measured length unless typed over (type the length incl. wastage).",
    `Material = order lm × $ / m + brackets × $ + screws × $${showReturns ? " + wall returns × $" : ""} · Labour = measured length × install $ / m (no wastage).`,
  ]);
  const [price, inst] = defaultsBlock(ws, LAST, "JOB DEFAULTS — used by every line that shows green", [
    { label: "Material — $ per metre", value: d.default_price, fmt: CURRENCY_FMT },
    { label: "Install — $ per metre", value: d.install_rate, fmt: CURRENCY_FMT },
  ]);
  ws.addRow([]);
  bandRow(ws, LAST, "LINES");

  const rows = lines.length ? lines : blankRails();
  const res = (l: RailLine) => computeRailLine(l, d);
  const returnsTerm = (ref: (k: string) => string) => (showReturns ? `+${ref("rt")}*${ref("rtP")}` : "");
  const t = lineTable<RailLine>(
    ws,
    [
      { key: "desc", header: "Description", width: 34, cell: (l) => text(l.description) },
      { key: "len", header: "Length lm", width: 10, fmt: QTY_FMT, sum: true, cell: (l) => input(l.length_lm) },
      { key: "order", header: "Order lm", width: 10, fmt: QTY_FMT, sum: true, cell: (l, ref) => inherit(l.order_lm, ref("len"), res(l).orderLm) },
      { key: "price", header: "$ / m", width: 10, fmt: CURRENCY_FMT, cell: (l) => inherit(l.price, price, d.default_price) },
      { key: "inst", header: "Install $ / m", width: 10, fmt: CURRENCY_FMT, cell: (l) => inherit(l.install_rate, inst, d.install_rate) },
      { key: "br", header: "Brackets", width: 9, fmt: INT_FMT, sum: true, cell: (l) => input(l.brackets_qty) },
      { key: "brP", header: "$ each", width: 9, fmt: CURRENCY_FMT, cell: (l) => input(l.bracket_price) },
      { key: "sc", header: "Screws", width: 9, fmt: INT_FMT, sum: true, cell: (l) => input(l.screws_qty) },
      { key: "scP", header: "$ each", width: 9, fmt: CURRENCY_FMT, cell: (l) => input(l.screw_price) },
      ...(showReturns
        ? [
            { key: "rt", header: "Wall returns", width: 9, fmt: INT_FMT, sum: true, cell: (l: RailLine) => input(l.returns_qty) },
            { key: "rtP", header: "$ each", width: 9, fmt: CURRENCY_FMT, cell: (l: RailLine) => input(l.return_price) },
          ]
        : []),
      {
        key: "mat",
        header: "Material",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) =>
          calc(
            `${ref("order")}*${ref("price")}+${ref("br")}*${ref("brP")}+${ref("sc")}*${ref("scP")}${returnsTerm(ref)}`,
            res(l).material
          ),
      },
      {
        key: "lab",
        header: "Labour",
        width: 12,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`${ref("len")}*${ref("inst")}`, res(l).labour),
      },
      {
        key: "total",
        header: "Line total",
        width: 13,
        fmt: CURRENCY_FMT,
        sum: true,
        cell: (l, ref) => calc(`${ref("mat")}+${ref("lab")}`, res(l).total),
      },
      { key: "notes", header: "Notes", width: 28, cell: (l) => text(l.notes) },
    ],
    rows,
    { totalLabel: "Lines subtotal", flag: { key: "inst", when: (ref) => `AND(${ref("len")}>0,${ref("inst")}=0)` } }
  );
  ws.addRow([]);
  const ref = totalBand(
    ws,
    lastCol,
    `${title.toUpperCase()} TOTAL`,
    lastCol - 1,
    `${t.col("total")}${t.totalRow}`,
    computeRails(lines, d).total
  );
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: t.first - 1 }];
  return ref;
}

function blankRails(): RailLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => ({
    id: `blank-${i}`,
    sort_order: i,
    description: null,
    length_lm: null,
    order_lm: null,
    price: null,
    install_rate: null,
    brackets_qty: 0,
    bracket_price: null,
    screws_qty: 0,
    screw_price: null,
    returns_qty: 0,
    return_price: null,
    notes: null,
  }));
}

// ── Summary ───────────────────────────────────────────────────────────────────

function summarySheet(
  ws: Sheet,
  args: ProtectionExcelArgs,
  today: string,
  trades: (TradeSubtotal & { ref: string })[]
) {
  const c = args.costing;
  const s = computeCostingSummary(trades, c);

  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 70;

  titleBlock(ws, "C", [
    { text: "Wall & Door Protection — Cost Estimate", size: 16, bold: true },
    { text: `${args.projectName} · ${args.estimateName}`, size: 11 },
    { text: `${args.orgName} · Exported ${today}`, size: 9, color: MUTED },
  ]);

  // Colour key
  const key: Row = ws.addRow(["Input — type over it", "Linked default", "Formula — calculated, don't type over"]);
  styleCell(key.getCell(1), "input");
  styleCell(key.getCell(2), "link");
  styleCell(key.getCell(3), "calc");
  ws.addRow(["Every sheet recalculates live. To add a line, insert a row above a sheet's subtotal row and copy the row above it."]).getCell(1).font =
    { italic: true, color: { argb: MUTED }, size: 9 };
  if (s.blockedLines > 0) {
    ws.addRow([
      `⚠ ${s.blockedLines} ${s.blockedLines === 1 ? "line has" : "lines have"} no install rate (highlighted amber on the trade sheets) — the app marks these totals incomplete.`,
    ]).getCell(1).font = { bold: true, color: { argb: "FFB45309" }, size: 10 };
  }
  ws.addRow([]);

  const line = (
    label: string,
    value: CellValue,
    explain: string,
    opts: { kind?: Kind; fmt?: string; bold?: boolean; size?: number; band?: boolean; indent?: boolean } = {}
  ) => {
    const row: Row = ws.addRow([label, value, explain]);
    const cell = row.getCell(2);
    styleCell(cell, opts.kind ?? "calc", opts.fmt ?? CURRENCY_FMT);
    row.getCell(1).font = { bold: !!opts.bold, color: { argb: opts.indent ? MUTED : SLATE_DARK }, size: opts.size ?? 10 };
    row.getCell(1).alignment = { indent: opts.indent ? 2 : 0 };
    row.getCell(3).font = { italic: true, color: { argb: MUTED }, size: 9 };
    if (opts.bold) cell.font = { ...cell.font, bold: true, size: opts.size ?? 10 };
    if (opts.band) {
      [1, 2, 3].forEach((i) => {
        row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_LIGHT } };
        row.getCell(i).border = { top: { style: "thin", color: { argb: BORDER_GREY } } };
      });
    }
    return `B${row.number}`;
  };
  const f = (formula: string, result: number): CellValue => ({ formula, result });

  bandRow(ws, "C", "PRICING");
  const markup = line("Markup on cost", pct(c.markup_pct), "Added to cost base + admin. Markup on cost, not margin.", { kind: "input", fmt: PCT2_FMT });
  const admin = line("Admin", pct(c.admin_pct), "Percentage of the cost base", { kind: "input", fmt: PCT2_FMT });
  const retention = line("Retention", pct(c.retention_pct), "Added to the price to recover what the client holds back. 0% = no retention.", {
    kind: "input",
    fmt: PCT2_FMT,
  });
  const gstRate = line("GST", GST_RATE, "", { kind: "input", fmt: PCT2_FMT });
  ws.addRow([]);

  bandRow(ws, "C", "ADDITIONAL COSTS");
  const prelims = line("Preliminaries", c.training, "Part of the cost base, so admin and markup apply", { kind: "input" });
  const acc = line("Accommodation", c.accommodation, "Pass-through: no admin or markup", { kind: "input" });
  const meals = line("Meals", c.meals, "Pass-through", { kind: "input" });
  const travel = line("Travel", c.travel, "Pass-through", { kind: "input" });
  const freight = line("Freight", c.freight, "Pass-through", { kind: "input" });
  ws.addRow([]);

  bandRow(ws, "C", "TRADES (cost) — linked to each trade sheet's total");
  const tradeRefs = trades.map((t) =>
    line(t.label, f(t.ref, t.subtotal ?? 0), t.subtotal === null ? "Not started in the app" : `${t.lines} ${t.lines === 1 ? "line" : "lines"}`, {
      kind: "link",
    })
  );
  const tradesSubtotal = line("Trades subtotal", f(`SUM(${tradeRefs[0]}:${tradeRefs[tradeRefs.length - 1]})`, s.tradesSubtotal), "", {
    bold: true,
    band: true,
  });
  ws.addRow([]);

  bandRow(ws, "C", "PRICE BUILD-UP");
  line("Trades subtotal", f(tradesSubtotal, s.tradesSubtotal), "From the trades above");
  line("+ Preliminaries", f(prelims, s.training), "");
  const costBase = line("= Cost base", f(`${tradesSubtotal}+${prelims}`, s.costBase), "Everything it costs us to do the job", {
    bold: true,
    band: true,
  });
  const adminAmt = line("+ Admin", f(`${costBase}*${admin}`, s.admin), "Cost base × admin %");
  const markupAmt = line("+ Markup", f(`(${costBase}+${adminAmt})*${markup}`, s.markup), "(Cost base + admin) × markup %");
  const pass = line("+ Pass-through costs", f(`${acc}+${meals}+${travel}+${freight}`, s.passThroughTotal), "Accommodation + meals + travel + freight");
  const before = line(
    "= Total before retention",
    f(`${costBase}+${adminAmt}+${markupAmt}+${pass}`, s.beforeRetention),
    "",
    { bold: true, band: true }
  );
  const retAmt = line("+ Retention", f(`${before}*${retention}`, s.retention), "Total before retention × retention %");
  const exGst = line("= Total ex GST", f(`${before}+${retAmt}`, s.totalExGst), "The quoted price", { bold: true, size: 12, band: true });
  const gst = line("+ GST", f(`${exGst}*${gstRate}`, s.gst), "");
  line("= TOTAL INC GST", f(`${exGst}+${gst}`, s.totalIncGst), "", { bold: true, size: 13, band: true });
  ws.addRow([]);

  bandRow(ws, "C", "PROFIT");
  line("Gross profit", f(markupAmt, s.grossProfit), "The markup. Admin, pass-through costs and retention are not counted as profit.", {
    bold: true,
  });
  line("Gross profit margin", f(`IF(${exGst}>0,${markupAmt}/${exGst},0)`, s.marginPct), "Gross profit ÷ total ex GST", {
    bold: true,
    fmt: PCT2_FMT,
  });

  sheetSetup(ws);
  ws.pageSetup.orientation = "portrait";
}

// ── Workbook ──────────────────────────────────────────────────────────────────

export type ProtectionExcelArgs = {
  orgName: string;
  projectName: string;
  estimateName: string;
  costing: CostingInputs;
  cornerGuards: { defaults: CornerGuardDefaults; lines: CornerGuardLine[] };
  wallPanels: { defaults: WallPanelDefaults; lines: WallPanelLine[]; rods: WeldRodLine[] };
  doorPanels: { lines: DoorPanelLine[] };
  crashRail: { defaults: RailDefaults; lines: RailLine[] };
  handrails: { defaults: RailDefaults; lines: RailLine[] };
};

export async function buildProtectionExcelBuffer(args: ProtectionExcelArgs): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = args.orgName;
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const subtitle = `${args.projectName} · ${args.estimateName}`;

  // Summary first in the tab order, filled in last (it links to the trade totals)
  const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: ACCENT } } });
  const sheet = (name: string) => {
    const ws = wb.addWorksheet(name);
    sheetSetup(ws);
    return ws;
  };

  const { cornerGuards: cg, wallPanels: wp, doorPanels: dp, crashRail: cr, handrails: hr } = args;
  const cgRef = cornerGuardSheet(sheet("Corner Guards"), subtitle, cg.defaults, cg.lines);
  const wpRef = wallPanelSheet(sheet("Wall Panels"), subtitle, wp.defaults, wp.lines, wp.rods);
  const dpRef = doorPanelSheet(sheet("Door Panels"), subtitle, dp.lines);
  const crRef = railSheet(
    sheet("Crash Rail"),
    "Crash rail",
    subtitle,
    cr.defaults,
    cr.lines,
    // The app hides wall returns on crash rail; show them only if a line still carries some
    cr.lines.some((l) => l.returns_qty > 0)
  );
  const hrRef = railSheet(sheet("Handrails"), "Handrails", subtitle, hr.defaults, hr.lines, true);

  // Same trade list as the Costing summary tab (corner-guard-editor.tsx)
  const cgT = computeEstimate(cg.lines, cg.defaults);
  const wpT = computeWallPanels(wp.lines, wp.rods, wp.defaults);
  const dpT = computeDoorPanels(dp.lines);
  const crT = computeRails(cr.lines, cr.defaults);
  const hrT = computeRails(hr.lines, hr.defaults);
  const wpCount = wp.lines.length + wp.rods.length;
  const trades = [
    { key: "corner-guards", label: "Corner guards", ref: cgRef, subtotal: cg.lines.length ? cgT.total : null, lines: cg.lines.length, blockedLines: cgT.blockedLines },
    { key: "wall-panels", label: "Wall panels", ref: wpRef, subtotal: wpCount ? wpT.total : null, lines: wpCount, blockedLines: wpT.blockedLines },
    { key: "door-panels", label: "Door panels", ref: dpRef, subtotal: dp.lines.length ? dpT.total : null, lines: dp.lines.length, blockedLines: dpT.blockedLines },
    { key: "crash-rail", label: "Crash rail", ref: crRef, subtotal: cr.lines.length ? crT.total : null, lines: cr.lines.length, blockedLines: crT.blockedLines },
    { key: "handrails", label: "Handrails", ref: hrRef, subtotal: hr.lines.length ? hrT.total : null, lines: hr.lines.length, blockedLines: hrT.blockedLines },
  ];
  summarySheet(summary, args, today, trades);

  return wb.xlsx.writeBuffer();
}

export async function exportProtectionExcel(args: ProtectionExcelArgs): Promise<void> {
  const buf = await buildProtectionExcelBuffer(args);
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${sanitizeFilename(`${args.projectName} - ${args.estimateName} - Wall & Door Protection`)}.xlsx`);
}
