// Handrail and crash rail costing (identical) — priced per linear metre.
// All amounts are cost (admin and markup are applied in the Costing summary).
// Line rate fields are nullable: null means "inherit the job default".
//
//   order length = typed-in length incl. wastage, else the measured length
//   labour       = measured length × install rate      (no wastage)
//   material     = order length × price per m + brackets × $ + screws × $

export type RailDefaults = {
  default_price: number | null;
  install_rate: number | null;
};

export type RailLine = {
  id: string;
  sort_order: number;
  description: string | null;
  length_lm: number | null;
  order_lm: number | null;
  price: number | null;
  install_rate: number | null;
  brackets_qty: number;
  bracket_price: number | null;
  screws_qty: number;
  screw_price: number | null;
  notes: string | null;
};

export type RailIssue =
  | { level: "block"; code: "missing_install"; message: string }
  | {
      level: "warn";
      code: "missing_price" | "order_below_length" | "missing_bracket_price" | "missing_screw_price";
      message: string;
    };

export function computeRailLine(line: RailLine, d: RailDefaults) {
  const length = line.length_lm ?? 0;
  const orderLm = line.order_lm ?? length;
  const price = line.price ?? d.default_price;
  const installRate = line.install_rate ?? d.install_rate;

  const issues: RailIssue[] = [];
  if (length > 0 && installRate === null)
    issues.push({ level: "block", code: "missing_install", message: "Install rate is required" });
  if (orderLm > 0 && price === null)
    issues.push({ level: "warn", code: "missing_price", message: "No material price per metre" });
  if (line.order_lm !== null && line.order_lm < length)
    issues.push({ level: "warn", code: "order_below_length", message: "Order length is less than the measured length" });
  if (line.brackets_qty > 0 && line.bracket_price === null)
    issues.push({ level: "warn", code: "missing_bracket_price", message: "Brackets entered but no price" });
  if (line.screws_qty > 0 && line.screw_price === null)
    issues.push({ level: "warn", code: "missing_screw_price", message: "Screws entered but no price" });

  const rail = orderLm * (price ?? 0);
  const brackets = line.brackets_qty * (line.bracket_price ?? 0);
  const screws = line.screws_qty * (line.screw_price ?? 0);
  const labour = length * (installRate ?? 0);
  const material = rail + brackets + screws;

  return { orderLm, price, installRate, rail, brackets, screws, material, labour, total: material + labour, issues };
}

export function computeRails(lines: RailLine[], d: RailDefaults) {
  const results = new Map(lines.map((l) => [l.id, computeRailLine(l, d)]));
  const t = {
    lengthLm: 0,
    orderLm: 0,
    material: 0,
    labour: 0,
    /** The tab subtotal fed into the costing summary. */
    total: 0,
    /** Lines with length but no install rate — the total must not be shown while > 0. */
    blockedLines: 0,
    results,
  };
  for (const l of lines) {
    const r = results.get(l.id)!;
    t.lengthLm += l.length_lm ?? 0;
    t.orderLm += r.orderLm;
    t.material += r.material;
    t.labour += r.labour;
    t.total += r.total;
    if (r.issues.some((i) => i.level === "block")) t.blockedLines++;
  }
  return t;
}

export type RailTotals = ReturnType<typeof computeRails>;
