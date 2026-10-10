// Corner guard costing — see the spec agreed 2026-10-10.
// All amounts are cost (no markup yet). Line rate fields are
// nullable: null means "inherit the job default".

export type CornerGuardDefaults = {
  default_price_std: number | null;
  default_price_nib: number | null;
  default_install_rate: number | null;
  default_coving_mm: number;
  cutting_enabled: boolean;
  default_cutting_rate: number | null;
};

export type CornerGuardLine = {
  id: string;
  sort_order: number;
  group_name: string | null;
  description: string | null;
  wall_height_mm: number | null;
  coving_mm: number | null;
  qty_std: number;
  qty_nib: number;
  price_std: number | null;
  price_nib: number | null;
  install_rate: number | null;
  cutting_enabled: boolean | null;
  cuts_qty: number;
  cutting_rate: number | null;
  notes: string | null;
};

export type LineIssue =
  | { level: "block"; code: "missing_install"; message: string }
  | { level: "error"; code: "coving_exceeds_wall"; message: string }
  | {
      level: "warn";
      code: "missing_price_std" | "missing_price_nib" | "no_cuts" | "missing_cutting_rate" | "install_rate_mismatch";
      message: string;
    };

export type LineResult = {
  coving: number;
  guardHeight: number | null;
  priceStd: number | null;
  priceNib: number | null;
  installRate: number | null;
  cuttingOn: boolean;
  cuttingRate: number | null;
  materialStd: number;
  materialNib: number;
  installStd: number;
  installNib: number;
  cutting: number;
  total: number;
  issues: LineIssue[];
};

export function computeLine(line: CornerGuardLine, d: CornerGuardDefaults): LineResult {
  const coving = line.coving_mm ?? d.default_coving_mm;
  const priceStd = line.price_std ?? d.default_price_std;
  const priceNib = line.price_nib ?? d.default_price_nib;
  const installRate = line.install_rate ?? d.default_install_rate;
  const cuttingOn = line.cutting_enabled ?? d.cutting_enabled;
  const cuttingRate = line.cutting_rate ?? d.default_cutting_rate;
  const qtyAll = line.qty_std + line.qty_nib;

  const issues: LineIssue[] = [];
  if (line.qty_std > 0 && !priceStd)
    issues.push({ level: "warn", code: "missing_price_std", message: "Standard guards have no material price" });
  if (line.qty_nib > 0 && !priceNib)
    issues.push({ level: "warn", code: "missing_price_nib", message: "Nib guards have no material price" });
  if (qtyAll > 0 && installRate === null)
    issues.push({ level: "block", code: "missing_install", message: "Install rate is required" });
  if (line.wall_height_mm !== null && coving >= line.wall_height_mm)
    issues.push({ level: "error", code: "coving_exceeds_wall", message: "Coving must be less than the wall height" });
  if (cuttingOn && line.cuts_qty === 0)
    issues.push({ level: "warn", code: "no_cuts", message: "Cutting is on but this line has 0 cuts" });
  if (cuttingOn && line.cuts_qty > 0 && cuttingRate === null)
    issues.push({ level: "warn", code: "missing_cutting_rate", message: "Cuts entered but no cutting rate" });

  const materialStd = line.qty_std * (priceStd ?? 0);
  const materialNib = line.qty_nib * (priceNib ?? 0);
  const installStd = line.qty_std * (installRate ?? 0);
  const installNib = line.qty_nib * (installRate ?? 0);
  const cutting = cuttingOn ? line.cuts_qty * (cuttingRate ?? 0) : 0;

  return {
    coving,
    guardHeight: line.wall_height_mm === null ? null : line.wall_height_mm - coving,
    priceStd,
    priceNib,
    installRate,
    cuttingOn,
    cuttingRate,
    materialStd,
    materialNib,
    installStd,
    installNib,
    cutting,
    total: materialStd + materialNib + installStd + installNib + cutting,
    issues,
  };
}

export type EstimateTotals = {
  qtyStd: number;
  qtyNib: number;
  materialStd: number;
  materialNib: number;
  installStd: number;
  installNib: number;
  cutting: number;
  /** Sum of all line totals — the corner guards subtotal fed into the costing summary. */
  total: number;
  /** Lines with qty but no install rate — the job total must not be shown while > 0 (rule 2). */
  blockedLines: number;
  /** Lines whose standard or nib material price comes from the job default rather than the line. */
  defaultPriceLines: number;
  /** Group heading → subtotal, in first-seen order. Lines without a heading go under "". */
  groups: { name: string; total: number; blocked: boolean }[];
  results: Map<string, LineResult>;
};

export function computeEstimate(lines: CornerGuardLine[], d: CornerGuardDefaults): EstimateTotals {
  const results = new Map(lines.map((l) => [l.id, computeLine(l, d)]));

  // Rule 5: same wall height priced at different install rates. Only the lines that
  // disagree are flagged, so typing the rate into a line clears that line's warning:
  // - a line using the job default is flagged when typed-in rates at that height differ from it
  // - a line with a typed-in rate is flagged when typed-in rates at that height disagree
  const typedRatesByHeight = new Map<number, Set<number>>();
  for (const l of lines) {
    if (l.wall_height_mm === null || l.install_rate === null || l.qty_std + l.qty_nib === 0) continue;
    const set = typedRatesByHeight.get(l.wall_height_mm) ?? new Set<number>();
    set.add(l.install_rate);
    typedRatesByHeight.set(l.wall_height_mm, set);
  }
  for (const l of lines) {
    const r = results.get(l.id)!;
    const typed = l.wall_height_mm === null ? undefined : typedRatesByHeight.get(l.wall_height_mm);
    if (!typed || r.installRate === null || l.qty_std + l.qty_nib === 0) continue;
    const rates = Array.from(typed)
      .map((x) => `$${x}`)
      .join(", ");
    if (l.install_rate === null && !typed.has(r.installRate)) {
      r.issues.push({
        level: "warn",
        code: "install_rate_mismatch",
        message: `Uses the job default install rate ($${r.installRate}) but other ${l.wall_height_mm} mm lines use ${rates}`,
      });
    } else if (l.install_rate !== null && typed.size > 1) {
      r.issues.push({
        level: "warn",
        code: "install_rate_mismatch",
        message: `${l.wall_height_mm} mm lines have different install rates (${rates})`,
      });
    }
  }

  const t: EstimateTotals = {
    qtyStd: 0,
    qtyNib: 0,
    materialStd: 0,
    materialNib: 0,
    installStd: 0,
    installNib: 0,
    cutting: 0,
    total: 0,
    blockedLines: 0,
    defaultPriceLines: 0,
    groups: [],
    results,
  };
  const groups = new Map<string, { name: string; total: number; blocked: boolean }>();
  for (const l of lines) {
    const r = results.get(l.id)!;
    const blocked = r.issues.some((i) => i.level === "block");
    t.qtyStd += l.qty_std;
    t.qtyNib += l.qty_nib;
    t.materialStd += r.materialStd;
    t.materialNib += r.materialNib;
    t.installStd += r.installStd;
    t.installNib += r.installNib;
    t.cutting += r.cutting;
    t.total += r.total;
    if (blocked) t.blockedLines++;
    if (
      (l.qty_std > 0 && l.price_std === null && d.default_price_std !== null) ||
      (l.qty_nib > 0 && l.price_nib === null && d.default_price_nib !== null)
    )
      t.defaultPriceLines++;

    const key = l.group_name?.trim() ?? "";
    const g = groups.get(key) ?? { name: key, total: 0, blocked: false };
    g.total += r.total;
    g.blocked ||= blocked;
    groups.set(key, g);
  }
  t.groups = Array.from(groups.values());
  return t;
}
