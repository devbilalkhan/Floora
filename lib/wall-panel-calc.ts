// Wall panel costing — SPM wall protection spec v1.0, checked against wall_panels.xlsx.
// All amounts are cost (admin and markup are applied in the Costing summary).
// Line rate/size fields are nullable: null means "inherit the job default".
//
//   sheet m²     = width mm ÷ 1000 × length mm ÷ 1000
//   base sheets  = override, else ROUNDUP(gross m² ÷ sheet m²)   (gross, never net — spec rule 11)
//   total sheets = ROUNDUP(base sheets × (1 + wastage %))        (wastage after base — rule 2)
//   material     = total sheets × price per sheet                (includes wastage — rule 3)
//   install      = base sheets × install rate                    (excludes wastage — rule 4)
//   glue         = base sheets × glue rate
//   cutouts      = cutouts × cutout rate
// Weld rods are separate lines (rule 6): qty × (1 + wastage %) × unit cost + labour.

export type WallPanelDefaults = {
  wp_sheet_width_mm: number;
  wp_sheet_length_mm: number;
  wp_wastage_pct: number;
  wp_default_price: number | null;
  wp_install_rate: number | null;
  wp_glue_rate: number | null;
  wp_cutout_rate: number | null;
};

export type WallPanelLine = {
  id: string;
  sort_order: number;
  item_code: string | null;
  product: string | null;
  gross_m2: number | null;
  net_m2: number | null;
  sheet_width_mm: number | null;
  sheet_length_mm: number | null;
  sheets_override: number | null;
  wastage_pct: number | null;
  price: number | null;
  install_rate: number | null;
  glue_rate: number | null;
  cutouts_qty: number;
  cutout_rate: number | null;
  notes: string | null;
};

export type WeldRodLine = {
  id: string;
  sort_order: number;
  description: string | null;
  qty: number;
  unit: string | null;
  unit_cost: number | null;
  wastage_pct: number;
  labour: number | null;
  notes: string | null;
};

export type WallPanelIssue =
  | { level: "block"; code: "missing_install"; message: string }
  | {
      level: "warn";
      code:
        | "missing_price"
        | "missing_glue"
        | "missing_cutout_rate"
        | "no_area"
        | "missing_product"
        | "override_below_area";
      message: string;
    };

export type WeldRodIssue = { level: "warn"; code: "missing_unit" | "missing_unit_cost"; message: string };

/**
 * Round up to a whole number, ignoring floating-point noise: 10 × 1.1 is
 * 11.000000000000002 in JS and must give 11 (Excel's CEILING hides this).
 */
export function roundUp(x: number) {
  return Math.ceil(Math.round(x * 1e6) / 1e6);
}

export function computeWallPanelLine(line: WallPanelLine, d: WallPanelDefaults) {
  const widthMm = line.sheet_width_mm ?? d.wp_sheet_width_mm;
  const lengthMm = line.sheet_length_mm ?? d.wp_sheet_length_mm;
  const sheetM2 = Math.round(widthMm * lengthMm) / 1e6;
  const wastagePct = line.wastage_pct ?? d.wp_wastage_pct;
  const price = line.price ?? d.wp_default_price;
  const installRate = line.install_rate ?? d.wp_install_rate;
  const glueRate = line.glue_rate ?? d.wp_glue_rate;
  const cutoutRate = line.cutout_rate ?? d.wp_cutout_rate;

  const areaSheets = line.gross_m2 !== null && sheetM2 > 0 ? roundUp(line.gross_m2 / sheetM2) : null;
  const baseSheets = line.sheets_override ?? areaSheets ?? 0;
  const totalSheets = roundUp(baseSheets * (1 + wastagePct / 100));

  const issues: WallPanelIssue[] = [];
  if (baseSheets > 0 && installRate === null)
    issues.push({ level: "block", code: "missing_install", message: "Install rate is required" });
  if (baseSheets > 0 && price === null)
    issues.push({ level: "warn", code: "missing_price", message: "No material price per sheet" });
  if (baseSheets > 0 && glueRate === null)
    issues.push({ level: "warn", code: "missing_glue", message: "No glue rate" });
  if (line.cutouts_qty > 0 && cutoutRate === null)
    issues.push({ level: "warn", code: "missing_cutout_rate", message: "Cutouts entered but no cutout rate" });
  if (line.gross_m2 === null && line.sheets_override === null && (line.product || line.item_code))
    issues.push({ level: "warn", code: "no_area", message: "No gross m² or sheet count" });
  if (baseSheets > 0 && !line.product?.trim())
    issues.push({ level: "warn", code: "missing_product", message: "No product entered" });
  if (line.sheets_override !== null && areaSheets !== null && line.sheets_override < areaSheets)
    issues.push({
      level: "warn",
      code: "override_below_area",
      message: `${line.sheets_override} sheets entered but ${line.gross_m2} m² needs at least ${areaSheets}`,
    });

  const material = totalSheets * (price ?? 0);
  const install = baseSheets * (installRate ?? 0);
  const glue = baseSheets * (glueRate ?? 0);
  const cutouts = line.cutouts_qty * (cutoutRate ?? 0);

  return {
    widthMm,
    lengthMm,
    sheetM2,
    areaSheets,
    baseSheets,
    wastagePct,
    wasteSheets: totalSheets - baseSheets,
    totalSheets,
    price,
    installRate,
    glueRate,
    cutoutRate,
    material,
    install,
    glue,
    cutouts,
    total: material + install + glue + cutouts,
    issues,
  };
}

export type WallPanelLineResult = ReturnType<typeof computeWallPanelLine>;

export function computeWeldRod(rod: WeldRodLine) {
  const issues: WeldRodIssue[] = [];
  if (rod.qty > 0 && !rod.unit?.trim())
    issues.push({ level: "warn", code: "missing_unit", message: "Unit not confirmed (m², lm, roll…)" });
  if (rod.qty > 0 && rod.unit_cost === null)
    issues.push({ level: "warn", code: "missing_unit_cost", message: "No supply cost per unit" });
  const supply = rod.qty * (1 + rod.wastage_pct / 100) * (rod.unit_cost ?? 0);
  return { supply, total: supply + (rod.labour ?? 0), issues };
}

export function computeWallPanels(lines: WallPanelLine[], rods: WeldRodLine[], d: WallPanelDefaults) {
  const results = new Map(lines.map((l) => [l.id, computeWallPanelLine(l, d)]));
  const rodResults = new Map(rods.map((r) => [r.id, computeWeldRod(r)]));
  const t = {
    grossM2: 0,
    baseSheets: 0,
    totalSheets: 0,
    material: 0,
    install: 0,
    glue: 0,
    cutouts: 0,
    panels: 0,
    weldRods: 0,
    /** Panels + weld rods — the wall panels subtotal fed into the costing summary. */
    total: 0,
    /** Lines with sheets but no install rate — the total must not be shown while > 0. */
    blockedLines: 0,
    results,
    rodResults,
  };
  for (const l of lines) {
    const r = results.get(l.id)!;
    t.grossM2 += l.gross_m2 ?? 0;
    t.baseSheets += r.baseSheets;
    t.totalSheets += r.totalSheets;
    t.material += r.material;
    t.install += r.install;
    t.glue += r.glue;
    t.cutouts += r.cutouts;
    t.panels += r.total;
    if (r.issues.some((i) => i.level === "block")) t.blockedLines++;
  }
  rodResults.forEach((r) => (t.weldRods += r.total));
  t.total = t.panels + t.weldRods;
  return t;
}

export type WallPanelTotals = ReturnType<typeof computeWallPanels>;

/**
 * Supply & install rate per installed panel (base sheet) — wastage is absorbed into the rate.
 *   cost rate = cost ÷ base sheets
 *   sell rate = cost rate × (1 + admin %) × (1 + markup %)   (same order as the Costing summary)
 * Ex GST; preliminaries, pass-through costs and retention are not included.
 */
export function supplyInstallRate(cost: number, baseSheets: number, adminPct: number, markupPct: number) {
  if (baseSheets <= 0) return null;
  const costRate = cost / baseSheets;
  return { cost: costRate, sell: costRate * (1 + adminPct / 100) * (1 + markupPct / 100) };
}
