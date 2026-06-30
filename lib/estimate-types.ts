import { FLOOR_PREP, LAB } from "./default-rates";

const FLOOR_PREP_BAGS_DIV = FLOOR_PREP.bagsDiv;
const FLOOR_PREP_COST_PER_BAG = FLOOR_PREP.matPerBag + FLOOR_PREP.labPerBag;

export type WetArea = {
  id: string;
  estimate_id: string;
  sort_order: number;
  name: string;
  floor_sqm: number;
  wall_semi_sqm: number;
  wall_full_sqm: number;
  coving_lm: number;
  qty: number;
  charge: number;
};

export function computeWetAreaLabor(wa: WetArea): number {
  return (
    (Number(wa.floor_sqm)     || 0) * LAB.vinyl +
    (Number(wa.wall_semi_sqm) || 0) * LAB.wallVinylSemi +
    (Number(wa.wall_full_sqm) || 0) * LAB.wallVinylFull +
    (Number(wa.coving_lm)     || 0) * LAB.coving
  );
}

export type EstimateItem = {
  id: string;
  estimate_id: string;
  parent_item_id: string | null;
  sort_order: number;
  type: "primary" | "consumable";
  scope_category: string;
  finish_code: string | null;
  description: string | null;
  qty: number;
  unit: string;
  waste_pct: number;
  cov_lm: number | null;
  cov_area: number | null;
  cov_height_mm: number | null;
  mat_rate: number;
  lab_rate: number;
  coverage_m2: number | null;
  is_auto: boolean;
  manufacturer: string | null;
  level: string | null;
  product_type: string | null;
};

export type EstimateSettings = {
  accounting_rate: number;
  admin_rate: number;
  net_markup_pct: number;
  freight: number;
  accommodation: number;
  travel_allowance: number;
  bailing_fee: number;
  floor_prep_area: number;
  floor_prep_depth_mm: number;
  floor_prep_charge_per_bag: number;
  floor_prep_mat_per_bag: number;
  floor_prep_lab_per_bag: number;
  grind_area: number;
  grind_labor_rate: number;
  grind_charge_rate: number;
};

export type Estimate = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  source_takeoff_id: string | null;
} & EstimateSettings;

// ── Calculation helpers ────────────────────────────────────────────────────────

export function itemMatQty(item: EstimateItem): number {
  if (item.type === "consumable") return item.qty;
  const totalArea = item.qty + (item.cov_area ?? 0);
  return totalArea * (1 + item.waste_pct / 100);
}

export function itemEffQty(item: EstimateItem): number {
  return itemMatQty(item);
}

export function itemMatCost(item: EstimateItem): number {
  return itemMatQty(item) * item.mat_rate;
}

export function itemLabCost(item: EstimateItem): number {
  // Labour always on base qty (no waste, no cov_area for primary rows)
  return item.qty * item.lab_rate;
}

export function itemTotal(item: EstimateItem): number {
  return itemMatCost(item) + itemLabCost(item);
}

export type Summary = {
  base: number;
  accountingCost: number;
  adminCost: number;
  subtotalAfterOverhead: number;
  markupAmount: number;
  subtotalAfterMarkup: number;
  additionalCosts: number;
  floorPrepBags: number;
  floorPrepRevenue: number;
  floorPrepCost: number;
  floorPrepProfit: number;
  grindCost: number;
  grindRevenue: number;
  grindProfit: number;
  wetAreasTotalLabor: number;
  wetAreasTotalCharge: number;
  wetAreasProfit: number;
  wetAreasCount: number;
  totalExGst: number;
  gst: number;
  grandTotal: number;
  grossMarginPct: number;
};

export function computeSummary(items: EstimateItem[], settings: EstimateSettings, wetAreas: WetArea[] = []): Summary {
  const wetAreasTotalLabor  = wetAreas.reduce((s, wa) => s + computeWetAreaLabor(wa) * (Number(wa.qty) || 1), 0);
  const wetAreasTotalCharge = wetAreas.reduce((s, wa) => s + (Number(wa.charge) || 0) * (Number(wa.qty) || 1), 0);
  const wetAreasProfit      = wetAreasTotalCharge - wetAreasTotalLabor;
  const wetAreasCount       = wetAreas.length;

  // Wet areas net diff (charge − labour) is part of base so markup applies to it
  const base = items.reduce((sum, item) => sum + itemTotal(item), 0) + wetAreasProfit;
  const accountingCost = base * settings.accounting_rate;
  const adminCost = base * settings.admin_rate;
  const subtotalAfterOverhead = base + accountingCost + adminCost;
  const markupAmount = subtotalAfterOverhead * settings.net_markup_pct;
  const additionalCosts =
    settings.freight +
    settings.accommodation +
    settings.travel_allowance +
    settings.bailing_fee;

  // Floor preparation — profit rolls directly into the markup section
  const floorPrepBags =
    settings.floor_prep_area > 0 && settings.floor_prep_depth_mm > 0
      ? Math.ceil((settings.floor_prep_area * settings.floor_prep_depth_mm) / FLOOR_PREP_BAGS_DIV)
      : 0;
  const floorPrepRevenue = settings.floor_prep_charge_per_bag * floorPrepBags;
  const floorPrepCost = (settings.floor_prep_mat_per_bag + settings.floor_prep_lab_per_bag) * floorPrepBags;
  const floorPrepProfit = floorPrepRevenue - floorPrepCost;

  // Grinding — per-m² surface prep; profit baked into margin same as floor prep
  const grindCost = (settings.grind_area ?? 0) * (settings.grind_labor_rate ?? 0);
  const grindRevenue = (settings.grind_area ?? 0) * (settings.grind_charge_rate ?? 0);
  const grindProfit = grindRevenue - grindCost;

  // subtotalAfterMarkup consolidates items markup + floor prep profit + grind profit
  const subtotalAfterMarkup = subtotalAfterOverhead + markupAmount + floorPrepProfit + grindProfit;
  // floor prep and grind costs are separate recovery lines — client pays cost + profit = full charge
  const totalExGst = subtotalAfterMarkup + additionalCosts + floorPrepCost + grindCost;
  const gst = totalExGst * 0.1;
  const grandTotal = totalExGst + gst;
  const grossMarginPct = totalExGst > 0 ? (markupAmount + floorPrepProfit + grindProfit) / totalExGst : 0;
  return {
    base,
    accountingCost,
    adminCost,
    subtotalAfterOverhead,
    markupAmount,
    subtotalAfterMarkup,
    additionalCosts,
    floorPrepBags,
    floorPrepRevenue,
    floorPrepCost,
    floorPrepProfit,
    grindCost,
    grindRevenue,
    grindProfit,
    wetAreasTotalLabor,
    wetAreasTotalCharge,
    wetAreasProfit,
    wetAreasCount,
    totalExGst,
    gst,
    grandTotal,
    grossMarginPct,
  };
}
