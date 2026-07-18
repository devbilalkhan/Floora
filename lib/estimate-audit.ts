// Independent verification of estimate calculations.
//
// Every formula below is deliberately re-derived from scratch rather than
// calling itemMatQty/itemMatCost/itemLabCost/computeSummary/computeWetAreaLabor
// from estimate-types.ts — the point is to catch bugs in that shared calc
// path, not just re-confirm it. Those functions are imported ONLY as the
// "official" values to diff against, never to produce the independent side.
//
// This module checks arithmetic only — it does not judge whether an item
// "should" exist (no presence/absence checks). If a row is there, its
// numbers get checked; if it's not there, it's simply not checked.
import type { EstimateItem, EstimateSettings, WetArea, Summary } from "./estimate-types";
import { itemMatCost, itemLabCost } from "./estimate-types";

const COVERAGE_M2 = 70; // m² per drum/bag — redeclared here, not imported from default-rates
const FILLET_LM = 15; // lm per coil — redeclared here, not imported from default-rates
const FLOOR_PREP_BAGS_DIV = 12;
// Wet-area labour rates are fixed constants in computeWetAreaLabor (not org-overridable) — redeclared here.
const WET_LAB_VINYL = 23;
const WET_LAB_WALL_SEMI = 29;
const WET_LAB_WALL_FULL = 35;
const WET_LAB_COVING = 25;
const CENT = 0.01;

export type AuditFinding = {
  itemLabel: string;
  check: string;
  expected: string;
  actual: string;
};

export type ScopeAuditReport = {
  scope: string;
  itemsChecked: number;
  consumablesChecked: number;
  mismatches: AuditFinding[];
  independentTotal: number;
  officialTotal: number;
};

export type GrandTotalAuditReport = {
  independentTotalExGst: number;
  independentGrandTotal: number;
  mismatches: AuditFinding[];
};

export type EstimateAuditReport = {
  scopes: ScopeAuditReport[];
  grandTotal: GrandTotalAuditReport;
};

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < CENT;
}
function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}
function label(item: EstimateItem): string {
  return item.finish_code || item.description || `#${item.id.slice(0, 8)}`;
}

// Fresh re-implementation of material/labour cost — mirrors the intent of
// itemMatQty/itemMatCost/itemLabCost but written independently.
function recomputeMaterialQty(item: EstimateItem): number {
  if (item.type === "consumable") return item.qty;
  return (item.qty + (item.cov_area ?? 0)) * (1 + item.waste_pct / 100);
}
function recomputeMaterialCost(item: EstimateItem): number {
  return recomputeMaterialQty(item) * item.mat_rate;
}
function recomputeLabourCost(item: EstimateItem): number {
  return item.qty * item.lab_rate;
}

// Expected qty for an auto-generated consumable child, re-derived from its
// parent's own stored fields. Returns null when the source data needed to
// re-derive it isn't available on the current row (e.g. standalone coved
// skirting doesn't persist its height on the primary) — those are skipped
// rather than reported, since we can't verify them, not because they're wrong.
function expectedChildQty(child: EstimateItem, parent: EstimateItem): number | null {
  const desc = child.description ?? "";
  const parentQty = Number(parent.qty) || 0;

  if (desc === "Weld Rod") return Math.ceil(parentQty / 2);
  if (desc === "Glue Carpet") return Math.ceil(parentQty / COVERAGE_M2);
  if (desc === "Carpet Underlay") return parentQty;

  if (desc === "Contact Brushable (Max Bond 102)" || desc === "Cove Fillet" || desc === "Coving Labour") {
    if (parent.scope_category !== "vinyl" && parent.scope_category !== "wall_vinyl") return null;
    const covArea = Number(parent.cov_area) || 0;
    const covLm = Number(parent.cov_lm) || 0;
    if (desc === "Contact Brushable (Max Bond 102)") return Math.ceil(covArea / COVERAGE_M2);
    if (desc === "Cove Fillet") return Math.ceil(covLm / FILLET_LM);
    return covLm; // Coving Labour
  }

  return null;
}

function auditScope(items: EstimateItem[], scope: string): ScopeAuditReport {
  const scopeItems = items.filter((i) => i.scope_category === scope);
  const primaries = scopeItems.filter((i) => i.type === "primary" && !i.parent_item_id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const mismatches: AuditFinding[] = [];
  let itemsChecked = 0;
  let consumablesChecked = 0;

  for (const it of scopeItems) {
    if (it.type === "primary") itemsChecked++;
    else consumablesChecked++;

    const indMat = recomputeMaterialCost(it);
    const offMat = itemMatCost(it);
    if (!close(indMat, offMat)) {
      mismatches.push({ itemLabel: label(it), check: "Material cost", expected: fmt(indMat), actual: fmt(offMat) });
    }

    const indLab = recomputeLabourCost(it);
    const offLab = itemLabCost(it);
    if (!close(indLab, offLab)) {
      mismatches.push({ itemLabel: label(it), check: "Labour cost", expected: fmt(indLab), actual: fmt(offLab) });
    }

    if (it.type === "consumable" && it.is_auto && it.parent_item_id) {
      const parent = byId.get(it.parent_item_id);
      const expectedQty = parent ? expectedChildQty(it, parent) : null;
      if (expectedQty !== null && Number(it.qty) !== expectedQty) {
        mismatches.push({
          itemLabel: `${label(parent!)} — ${it.description}`,
          check: "Quantity formula",
          expected: `${expectedQty} ${it.unit}`,
          actual: `${it.qty} ${it.unit}`,
        });
      }
    }
  }

  // Section-level consumables (Glue, Feather Finish) — shared across every primary in the scope
  if (scope === "vinyl" || scope === "wall_vinyl") {
    const totalArea = primaries.reduce((s, p) => s + (Number(p.qty) || 0), 0);
    const gluableArea = primaries.filter((p) => p.product_type !== "plank_floating").reduce((s, p) => s + (Number(p.qty) || 0), 0);
    const sectionRows = scopeItems.filter((i) => i.type === "consumable" && !i.parent_item_id && i.is_auto);

    const glueRow = sectionRows.find((r) => r.description === "Glue Sheet/Plank");
    if (glueRow) {
      const expected = Math.ceil(gluableArea / COVERAGE_M2);
      if (Number(glueRow.qty) !== expected) {
        mismatches.push({ itemLabel: "Section — Glue Sheet/Plank", check: "Quantity formula", expected: `${expected} drum`, actual: `${glueRow.qty} drum` });
      }
    }
    const ffMatRow = sectionRows.find((r) => r.description === "Feather Finish 20kg");
    if (ffMatRow) {
      const expected = Math.ceil(totalArea / COVERAGE_M2);
      if (Number(ffMatRow.qty) !== expected) {
        mismatches.push({ itemLabel: "Section — Feather Finish 20kg", check: "Quantity formula", expected: `${expected} bag`, actual: `${ffMatRow.qty} bag` });
      }
    }
    const ffLabRow = sectionRows.find((r) => r.description === "Feather Finish Labour");
    if (ffLabRow && Number(ffLabRow.qty) !== totalArea) {
      mismatches.push({ itemLabel: "Section — Feather Finish Labour", check: "Quantity formula", expected: `${totalArea} m²`, actual: `${ffLabRow.qty} m²` });
    }
  }

  const independentTotal = scopeItems.reduce((s, i) => s + recomputeMaterialCost(i) + recomputeLabourCost(i), 0);
  const officialTotal = scopeItems.reduce((s, i) => s + itemMatCost(i) + itemLabCost(i), 0);

  return { scope, itemsChecked, consumablesChecked, mismatches, independentTotal, officialTotal };
}

function independentWetAreaLabor(wa: WetArea): number {
  return (
    (Number(wa.floor_sqm) || 0) * WET_LAB_VINYL +
    (Number(wa.wall_semi_sqm) || 0) * WET_LAB_WALL_SEMI +
    (Number(wa.wall_full_sqm) || 0) * WET_LAB_WALL_FULL +
    (Number(wa.coving_lm) || 0) * WET_LAB_COVING
  );
}

function auditGrandTotal(
  items: EstimateItem[],
  settings: EstimateSettings,
  wetAreas: WetArea[],
  officialSummary: Summary
): GrandTotalAuditReport {
  const wetAreasTotalLabor = wetAreas.reduce((s, wa) => s + independentWetAreaLabor(wa) * (Number(wa.qty) || 1), 0);
  const wetAreasTotalCharge = wetAreas.reduce((s, wa) => s + (Number(wa.charge) || 0) * (Number(wa.qty) || 1), 0);
  const wetAreasProfit = wetAreasTotalCharge - wetAreasTotalLabor;

  const base = items.reduce((s, i) => s + recomputeMaterialCost(i) + recomputeLabourCost(i), 0) + wetAreasProfit;
  const accountingCost = base * settings.accounting_rate;
  const adminCost = base * settings.admin_rate;
  const subtotalAfterOverhead = base + accountingCost + adminCost;
  const markupAmount = subtotalAfterOverhead * settings.net_markup_pct;
  const additionalCosts = settings.freight + settings.accommodation + settings.travel_allowance + settings.bailing_fee;

  const floorPrepBags =
    settings.floor_prep_area > 0 && settings.floor_prep_depth_mm > 0
      ? Math.ceil((settings.floor_prep_area * settings.floor_prep_depth_mm) / FLOOR_PREP_BAGS_DIV)
      : 0;
  const floorPrepRevenue = settings.floor_prep_charge_per_bag * floorPrepBags;
  const floorPrepCost = (settings.floor_prep_mat_per_bag + settings.floor_prep_lab_per_bag) * floorPrepBags;
  const floorPrepProfit = floorPrepRevenue - floorPrepCost;

  const grindCost = (settings.grind_area ?? 0) * (settings.grind_labor_rate ?? 0);
  const grindRevenue = (settings.grind_area ?? 0) * (settings.grind_charge_rate ?? 0);
  const grindProfit = grindRevenue - grindCost;

  const subtotalAfterMarkup = subtotalAfterOverhead + markupAmount + floorPrepProfit + grindProfit;
  const totalExGst = subtotalAfterMarkup + additionalCosts + floorPrepCost + grindCost;
  const gst = totalExGst * 0.1;
  const grandTotal = totalExGst + gst;

  const mismatches: AuditFinding[] = [];
  const checks: [string, number, number][] = [
    ["Base cost", base, officialSummary.base],
    ["Accounting overhead", accountingCost, officialSummary.accountingCost],
    ["Admin overhead", adminCost, officialSummary.adminCost],
    ["Mark-up amount", markupAmount, officialSummary.markupAmount],
    ["Additional costs", additionalCosts, officialSummary.additionalCosts],
    ["Floor prep cost", floorPrepCost, officialSummary.floorPrepCost],
    ["Grind cost", grindCost, officialSummary.grindCost],
    ["Total ex-GST", totalExGst, officialSummary.totalExGst],
    ["GST", gst, officialSummary.gst],
    ["Grand total (incl. GST)", grandTotal, officialSummary.grandTotal],
  ];
  for (const [name, ind, off] of checks) {
    if (!close(ind, off)) {
      mismatches.push({ itemLabel: "Estimate", check: name, expected: fmt(ind), actual: fmt(off) });
    }
  }

  return { independentTotalExGst: totalExGst, independentGrandTotal: grandTotal, mismatches };
}

/**
 * Audits every calculation in the estimate: per-item material/labour cost,
 * auto-consumable quantity formulas (where re-derivable), per-scope cost
 * totals, and the estimate-wide overhead/markup/GST/grand-total chain.
 * Read-only, no presence/absence judgment — numbers only.
 */
export function auditEstimate(
  items: EstimateItem[],
  settings: EstimateSettings,
  wetAreas: WetArea[],
  officialSummary: Summary
): EstimateAuditReport {
  const scopeKeys = Array.from(
    new Set(items.filter((i) => i.type === "primary" && !i.parent_item_id).map((i) => i.scope_category))
  );
  const scopes = scopeKeys.map((scope) => auditScope(items, scope));
  const grandTotal = auditGrandTotal(items, settings, wetAreas, officialSummary);
  return { scopes, grandTotal };
}
