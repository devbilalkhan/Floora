// Door panel costing — every rate is typed per line (no job defaults).
// All amounts are cost (admin and markup are applied in the Costing summary).
//
//   material = sheets × price per sheet
//   install  = panels × install rate  (+ cut qty × cutting rate when cutting is ticked)
//   cut qty  = typed-in number of panels to cut, else the panels qty
//   glue     = panels × glue rate
//   total    = material + install + glue

export type DoorPanelLine = {
  id: string;
  sort_order: number;
  item: string | null;
  sheets_qty: number;
  price: number | null;
  panels_qty: number;
  install_rate: number | null;
  cutting_enabled: boolean;
  cut_qty: number | null;
  cutting_rate: number | null;
  glue_rate: number | null;
  notes: string | null;
};

export type DoorPanelIssue =
  | { level: "block"; code: "missing_install"; message: string }
  | { level: "warn"; code: "missing_price" | "missing_cutting_rate" | "missing_glue" | "missing_item"; message: string };

export function computeDoorPanelLine(line: DoorPanelLine) {
  const cutQty = line.cut_qty ?? line.panels_qty;
  const issues: DoorPanelIssue[] = [];
  if (line.panels_qty > 0 && line.install_rate === null)
    issues.push({ level: "block", code: "missing_install", message: "Install rate is required" });
  if (line.sheets_qty > 0 && line.price === null)
    issues.push({ level: "warn", code: "missing_price", message: "No price per sheet" });
  if (line.cutting_enabled && cutQty > 0 && line.cutting_rate === null)
    issues.push({ level: "warn", code: "missing_cutting_rate", message: "Cutting is ticked but has no rate" });
  if (line.panels_qty > 0 && line.glue_rate === null)
    issues.push({ level: "warn", code: "missing_glue", message: "No glue rate" });
  if ((line.sheets_qty > 0 || line.panels_qty > 0) && !line.item?.trim())
    issues.push({ level: "warn", code: "missing_item", message: "No item name" });

  const material = line.sheets_qty * (line.price ?? 0);
  const cutting = line.cutting_enabled ? cutQty * (line.cutting_rate ?? 0) : 0;
  const install = line.panels_qty * (line.install_rate ?? 0) + cutting;
  const glue = line.panels_qty * (line.glue_rate ?? 0);
  return { cutQty, material, cutting, install, glue, total: material + install + glue, issues };
}

export function computeDoorPanels(lines: DoorPanelLine[]) {
  const results = new Map(lines.map((l) => [l.id, computeDoorPanelLine(l)]));
  const t = {
    sheets: 0,
    panels: 0,
    material: 0,
    install: 0,
    glue: 0,
    /** The door panels subtotal fed into the costing summary. */
    total: 0,
    /** Lines with panels but no install rate — the total must not be shown while > 0. */
    blockedLines: 0,
    results,
  };
  for (const l of lines) {
    const r = results.get(l.id)!;
    t.sheets += l.sheets_qty;
    t.panels += l.panels_qty;
    t.material += r.material;
    t.install += r.install;
    t.glue += r.glue;
    t.total += r.total;
    if (r.issues.some((i) => i.level === "block")) t.blockedLines++;
  }
  return t;
}

export type DoorPanelTotals = ReturnType<typeof computeDoorPanels>;
