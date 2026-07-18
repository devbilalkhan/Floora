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
//
// Every check carries a `working` string showing the actual formula with
// real numbers substituted in, so the result isn't just a pass/fail — the
// user can see exactly what was included and how the number was reached.
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

export type AuditCheck = {
  itemLabel: string;
  check: string;
  working: string;
  expected: string;
  actual: string;
  pass: boolean;
};

export type ScopeAuditReport = {
  scope: string;
  itemsChecked: number;
  consumablesChecked: number;
  checks: AuditCheck[];
  independentTotal: number;
  officialTotal: number;
};

export type GrandTotalAuditReport = {
  independentTotalExGst: number;
  independentGrandTotal: number;
  checks: AuditCheck[];
};

export type EstimateAuditReport = {
  scopes: ScopeAuditReport[];
  grandTotal: GrandTotalAuditReport;
};

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < CENT;
}
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}
function label(item: EstimateItem): string {
  const raw = item.finish_code || item.description || `#${item.id.slice(0, 8)}`;
  const words = raw.trim().split(/\s+/);
  return words.length > 4 ? `${words.slice(0, 4).join(" ")}…` : raw;
}

// Fresh re-implementation of material/labour cost — mirrors the intent of
// itemMatQty/itemMatCost/itemLabCost but written independently.
function materialCostWorking(item: EstimateItem): { working: string; value: number } {
  if (item.type === "consumable") {
    const value = item.qty * item.mat_rate;
    return { working: `${num(item.qty)} ${item.unit} × ${money(item.mat_rate)} = ${money(value)}`, value };
  }
  const covArea = item.cov_area ?? 0;
  const qtyPart = covArea > 0 ? `(${num(item.qty)} + ${num(covArea)} cov)` : num(item.qty);
  const matQty = (item.qty + covArea) * (1 + item.waste_pct / 100);
  const value = matQty * item.mat_rate;
  return { working: `${qtyPart} × (1 + ${num(item.waste_pct)}% waste) × ${money(item.mat_rate)} = ${money(value)}`, value };
}
function labourCostWorking(item: EstimateItem): { working: string; value: number } {
  const value = item.qty * item.lab_rate;
  return { working: `${num(item.qty)} ${item.unit} × ${money(item.lab_rate)} = ${money(value)}`, value };
}
function recomputeMaterialCost(item: EstimateItem): number {
  return materialCostWorking(item).value;
}
function recomputeLabourCost(item: EstimateItem): number {
  return labourCostWorking(item).value;
}

// Expected qty for an auto-generated consumable child, re-derived from its
// parent's own stored fields. Returns null when the source data needed to
// re-derive it isn't available on the current row (e.g. standalone coved
// skirting doesn't persist its height on the primary) — those are skipped
// rather than reported, since we can't verify them, not because they're wrong.
function childQtyWorking(child: EstimateItem, parent: EstimateItem): { working: string; value: number } | null {
  const desc = child.description ?? "";
  const parentQty = Number(parent.qty) || 0;

  if (desc === "Weld Rod") {
    const value = Math.ceil(parentQty / 2);
    return { working: `ceil(${num(parentQty)} / 2) = ${value} lm`, value };
  }
  if (desc === "Glue Carpet") {
    const value = Math.ceil(parentQty / COVERAGE_M2);
    return { working: `ceil(${num(parentQty)} / ${COVERAGE_M2}) = ${value} drum`, value };
  }
  if (desc === "Carpet Underlay") {
    return { working: `= ${num(parentQty)} m²`, value: parentQty };
  }
  if (desc === "Contact Brushable (Max Bond 102)" || desc === "Cove Fillet" || desc === "Coving Labour") {
    if (parent.scope_category !== "vinyl" && parent.scope_category !== "wall_vinyl") return null;
    const covArea = Number(parent.cov_area) || 0;
    const covLm = Number(parent.cov_lm) || 0;
    if (desc === "Contact Brushable (Max Bond 102)") {
      const value = Math.ceil(covArea / COVERAGE_M2);
      return { working: `ceil(${num(covArea)} / ${COVERAGE_M2}) = ${value} drum`, value };
    }
    if (desc === "Cove Fillet") {
      const value = Math.ceil(covLm / FILLET_LM);
      return { working: `ceil(${num(covLm)} / ${FILLET_LM}) = ${value} coil`, value };
    }
    return { working: `= ${num(covLm)} lm`, value: covLm };
  }
  return null;
}

function auditScope(items: EstimateItem[], scope: string): ScopeAuditReport {
  const scopeItems = items.filter((i) => i.scope_category === scope);
  const primaries = scopeItems.filter((i) => i.type === "primary" && !i.parent_item_id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const checks: AuditCheck[] = [];
  let itemsChecked = 0;
  let consumablesChecked = 0;

  for (const it of scopeItems) {
    if (it.type === "primary") itemsChecked++;
    else consumablesChecked++;

    const mat = materialCostWorking(it);
    const offMat = itemMatCost(it);
    checks.push({
      itemLabel: label(it),
      check: "Material cost",
      working: mat.working,
      expected: money(mat.value),
      actual: money(offMat),
      pass: close(mat.value, offMat),
    });

    const lab = labourCostWorking(it);
    const offLab = itemLabCost(it);
    checks.push({
      itemLabel: label(it),
      check: "Labour cost",
      working: lab.working,
      expected: money(lab.value),
      actual: money(offLab),
      pass: close(lab.value, offLab),
    });

    if (it.type === "consumable" && it.is_auto && it.parent_item_id) {
      const parent = byId.get(it.parent_item_id);
      const qty = parent ? childQtyWorking(it, parent) : null;
      if (qty) {
        checks.push({
          itemLabel: `${label(parent!)} — ${it.description}`,
          check: "Quantity formula",
          working: qty.working,
          expected: `${qty.value} ${it.unit}`,
          actual: `${it.qty} ${it.unit}`,
          pass: Number(it.qty) === qty.value,
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
      const value = Math.ceil(gluableArea / COVERAGE_M2);
      checks.push({
        itemLabel: "Section — Glue Sheet/Plank",
        check: "Quantity formula",
        working: `ceil(${num(gluableArea)} gluable m² / ${COVERAGE_M2}) = ${value} drum`,
        expected: `${value} drum`,
        actual: `${glueRow.qty} drum`,
        pass: Number(glueRow.qty) === value,
      });
    }
    const ffMatRow = sectionRows.find((r) => r.description === "Feather Finish 20kg");
    if (ffMatRow) {
      const value = Math.ceil(totalArea / COVERAGE_M2);
      checks.push({
        itemLabel: "Section — Feather Finish 20kg",
        check: "Quantity formula",
        working: `ceil(${num(totalArea)} total m² / ${COVERAGE_M2}) = ${value} bag`,
        expected: `${value} bag`,
        actual: `${ffMatRow.qty} bag`,
        pass: Number(ffMatRow.qty) === value,
      });
    }
    const ffLabRow = sectionRows.find((r) => r.description === "Feather Finish Labour");
    if (ffLabRow) {
      checks.push({
        itemLabel: "Section — Feather Finish Labour",
        check: "Quantity formula",
        working: `= ${num(totalArea)} total m²`,
        expected: `${totalArea} m²`,
        actual: `${ffLabRow.qty} m²`,
        pass: Number(ffLabRow.qty) === totalArea,
      });
    }
  }

  const independentTotal = scopeItems.reduce((s, i) => s + recomputeMaterialCost(i) + recomputeLabourCost(i), 0);
  const officialTotal = scopeItems.reduce((s, i) => s + itemMatCost(i) + itemLabCost(i), 0);

  return { scope, itemsChecked, consumablesChecked, checks, independentTotal, officialTotal };
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

  const itemsCost = items.reduce((s, i) => s + recomputeMaterialCost(i) + recomputeLabourCost(i), 0);
  const base = itemsCost + wetAreasProfit;
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

  const checks: AuditCheck[] = [];
  const push = (check: string, working: string, ind: number, off: number) => {
    checks.push({ itemLabel: "Estimate", check, working, expected: money(ind), actual: money(off), pass: close(ind, off) });
  };

  push(
    "Base cost",
    `Σ material + labour, every item${wetAreasProfit !== 0 ? ` (${money(itemsCost)})` : ""}${
      wetAreasProfit !== 0 ? ` + wet-area profit (${money(wetAreasProfit)})` : ""
    } = ${money(base)}`,
    base,
    officialSummary.base
  );
  push("Accounting overhead", `${money(base)} base × ${pct(settings.accounting_rate)} = ${money(accountingCost)}`, accountingCost, officialSummary.accountingCost);
  push("Admin overhead", `${money(base)} base × ${pct(settings.admin_rate)} = ${money(adminCost)}`, adminCost, officialSummary.adminCost);
  push(
    "Mark-up amount",
    `(${money(base)} base + ${money(accountingCost)} accounting + ${money(adminCost)} admin) × ${pct(settings.net_markup_pct)} = ${money(markupAmount)}`,
    markupAmount,
    officialSummary.markupAmount
  );
  push(
    "Additional costs",
    `Freight ${money(settings.freight)} + Accommodation ${money(settings.accommodation)} + Travel ${money(settings.travel_allowance)} + Bailing ${money(settings.bailing_fee)} = ${money(additionalCosts)}`,
    additionalCosts,
    officialSummary.additionalCosts
  );
  push(
    "Floor prep cost",
    floorPrepBags > 0
      ? `${floorPrepBags} bag(s) × (${money(settings.floor_prep_mat_per_bag)} mat + ${money(settings.floor_prep_lab_per_bag)} lab) = ${money(floorPrepCost)}`
      : "no floor prep area set — $0.00",
    floorPrepCost,
    officialSummary.floorPrepCost
  );
  push(
    "Grind cost",
    grindCost > 0 ? `${num(settings.grind_area ?? 0)} m² × ${money(settings.grind_labor_rate ?? 0)}/m² = ${money(grindCost)}` : "no grind area set — $0.00",
    grindCost,
    officialSummary.grindCost
  );
  push(
    "Total ex-GST",
    `Subtotal after mark-up (${money(subtotalAfterMarkup)}) + additional (${money(additionalCosts)}) + floor prep (${money(floorPrepCost)}) + grind (${money(grindCost)}) = ${money(totalExGst)}`,
    totalExGst,
    officialSummary.totalExGst
  );
  push("GST", `${money(totalExGst)} × 10% = ${money(gst)}`, gst, officialSummary.gst);
  push("Grand total (incl. GST)", `${money(totalExGst)} + ${money(gst)} GST = ${money(grandTotal)}`, grandTotal, officialSummary.grandTotal);

  return { independentTotalExGst: totalExGst, independentGrandTotal: grandTotal, checks };
}

/**
 * Audits every calculation in the estimate: per-item material/labour cost,
 * auto-consumable quantity formulas (where re-derivable), per-scope cost
 * totals, and the estimate-wide overhead/markup/GST/grand-total chain.
 * Read-only, no presence/absence judgment — numbers only, with the working
 * shown for every check so it's clear what was included.
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
