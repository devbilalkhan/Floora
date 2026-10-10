// Costing summary for a protection estimate — rolls every product tab up into one price.
// Same order as the flooring estimate (see lib/estimate-types.ts computeSummary):
//   cost base   = trade subtotals + training
//   admin       = cost base × admin %
//   markup      = (cost base + admin) × markup %          ← markup on cost, not margin
//   pass-through = accommodation + meals + travel + freight (never marked up)
//   total ex GST = cost base + admin + markup + pass-through
//   GST 10%

export type CostingInputs = {
  training: number | null;
  accommodation: number | null;
  meals: number | null;
  travel: number | null;
  freight: number | null;
  /** Whole-number percent, e.g. 7 */
  admin_pct: number;
  /** Whole-number percent, 0–100 */
  markup_pct: number;
};

export type TradeSubtotal = {
  key: string;
  label: string;
  /** null = this product tab isn't built / has no lines yet */
  subtotal: number | null;
  lines: number;
  /** Lines that block the total (e.g. corner guards missing an install rate) */
  blockedLines: number;
};

export const GST_RATE = 0.1;

export function computeCostingSummary(trades: TradeSubtotal[], c: CostingInputs) {
  const tradesSubtotal = trades.reduce((s, t) => s + (t.subtotal ?? 0), 0);
  const training = c.training ?? 0;
  const costBase = tradesSubtotal + training;
  const admin = costBase * (c.admin_pct / 100);
  const subtotalAfterAdmin = costBase + admin;
  const markup = subtotalAfterAdmin * (c.markup_pct / 100);
  const passThrough = {
    accommodation: c.accommodation ?? 0,
    meals: c.meals ?? 0,
    travel: c.travel ?? 0,
    freight: c.freight ?? 0,
  };
  const passThroughTotal = passThrough.accommodation + passThrough.meals + passThrough.travel + passThrough.freight;
  const totalExGst = subtotalAfterAdmin + markup + passThroughTotal;
  const gst = totalExGst * GST_RATE;

  return {
    tradesSubtotal,
    training,
    costBase,
    admin,
    subtotalAfterAdmin,
    markup,
    passThrough,
    passThroughTotal,
    totalExGst,
    gst,
    totalIncGst: totalExGst + gst,
    /** Gross profit = the markup; admin and pass-through costs are treated as cost (as in the flooring estimate) */
    grossProfit: markup,
    /** Gross profit as a share of the ex-GST price */
    marginPct: totalExGst > 0 ? markup / totalExGst : 0,
    blockedLines: trades.reduce((s, t) => s + t.blockedLines, 0),
  };
}

export type CostingSummary = ReturnType<typeof computeCostingSummary>;
