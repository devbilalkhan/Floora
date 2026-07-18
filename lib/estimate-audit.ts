// Independent verification of estimate calculations.
//
// The formulas below are deliberately re-derived from scratch rather than
// calling itemMatQty/itemMatCost/itemLabCost from estimate-types.ts — the
// point is to catch bugs in that shared calc path, not just re-confirm it.
// itemMatCost/itemLabCost/itemTotal are imported ONLY as the "official"
// values to diff against, never to produce the independent side.
import type { EstimateItem } from "./estimate-types";
import { itemMatCost, itemLabCost, itemTotal } from "./estimate-types";

const COVERAGE_M2 = 70; // m² per drum/bag — redeclared here, not imported from default-rates
const CENT = 0.01;

export type AuditLevel = "pass" | "warn" | "fail" | "info";

export type AuditFinding = {
  level: AuditLevel;
  itemLabel: string;
  check: string;
  expected: string;
  actual: string;
};

export type ScopeAuditReport = {
  scope: string;
  findings: AuditFinding[];
  independentTotals: { mat: number; lab: number; total: number };
};

function isPlank(productType: string | null): boolean {
  return productType === "plank_glued" || productType === "plank_floating";
}
function isFloating(productType: string | null): boolean {
  return productType === "plank_floating";
}

// Fresh re-implementation of material qty/cost — mirrors the intent of
// itemMatQty/itemMatCost but written independently.
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

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < CENT;
}

/**
 * Audits vinyl-plank rows (product_type "plank_glued" / "plank_floating")
 * within a single scope ("vinyl" or "wall_vinyl"). Checks:
 *  1. Plank rows never carry a Weld Rod child (planks are clicked/glued, not welded).
 *  2. Plank rows never carry coving data or coving children (planks can't cove).
 *  3. Each plank's material/labour cost, independently recomputed, matches the
 *     value the estimation page's own calc functions produce.
 *  4. The section-level Glue Sheet/Plank qty is correct (excludes floating planks).
 *  5. The section-level Feather Finish qty/labour is correct (includes all planks).
 *  6. The scope's total cost, independently summed from every item, matches
 *     what's passed in as the page's displayed total.
 */
export function auditVinylPlanks(
  items: EstimateItem[],
  scope: "vinyl" | "wall_vinyl",
  displayedScopeTotal?: { mat: number; lab: number }
): ScopeAuditReport {
  const findings: AuditFinding[] = [];
  const scopeItems = items.filter((i) => i.scope_category === scope);
  const primaries = scopeItems.filter((i) => i.type === "primary" && !i.parent_item_id);
  const planks = primaries.filter((p) => isPlank(p.product_type));

  const childrenByParent = new Map<string, EstimateItem[]>();
  scopeItems
    .filter((i) => i.parent_item_id)
    .forEach((c) => {
      const arr = childrenByParent.get(c.parent_item_id as string) ?? [];
      arr.push(c);
      childrenByParent.set(c.parent_item_id as string, arr);
    });
  const sectionRows = scopeItems.filter((i) => i.type === "consumable" && !i.parent_item_id && i.is_auto);

  if (planks.length === 0) {
    findings.push({
      level: "info",
      itemLabel: "—",
      check: "Plank rows present",
      expected: "n/a",
      actual: "no plank_glued / plank_floating rows in this scope",
    });
  }

  for (const plank of planks) {
    const label = plank.finish_code || plank.description || `#${plank.id.slice(0, 8)}`;
    const children = childrenByParent.get(plank.id) ?? [];

    // 1. No Weld Rod
    const weldRod = children.find((c) => c.description === "Weld Rod");
    findings.push({
      level: weldRod ? "fail" : "pass",
      itemLabel: label,
      check: "Weld Rod excluded (planks are clicked/glued, not welded)",
      expected: "no Weld Rod child",
      actual: weldRod ? `found, qty ${weldRod.qty}` : "absent",
    });

    // 2. No coving
    const hasCovingData = (plank.cov_lm ?? 0) > 0 || (plank.cov_area ?? 0) > 0;
    const covingDescs = new Set(["Contact Brushable (Max Bond 102)", "Cove Fillet", "Coving Labour"]);
    const covingChildren = children.filter((c) => covingDescs.has(c.description ?? ""));
    findings.push({
      level: hasCovingData || covingChildren.length > 0 ? "fail" : "pass",
      itemLabel: label,
      check: "No coving on plank rows (planks can't cove)",
      expected: "cov_lm/cov_area empty, no coving children",
      actual: hasCovingData
        ? `cov_lm=${plank.cov_lm ?? 0}, cov_area=${plank.cov_area ?? 0}`
        : covingChildren.length > 0
        ? `${covingChildren.length} coving child row(s) present`
        : "clean",
    });

    // 3. Cost cross-check: independent recompute vs the page's own calc functions
    const indMat = recomputeMaterialCost(plank);
    const offMat = itemMatCost(plank);
    findings.push({
      level: close(indMat, offMat) ? "pass" : "fail",
      itemLabel: label,
      check: "Material cost cross-check",
      expected: `$${indMat.toFixed(2)} (independent recompute)`,
      actual: `$${offMat.toFixed(2)} (estimation page)`,
    });

    const indLab = recomputeLabourCost(plank);
    const offLab = itemLabCost(plank);
    findings.push({
      level: close(indLab, offLab) ? "pass" : "fail",
      itemLabel: label,
      check: "Labour cost cross-check",
      expected: `$${indLab.toFixed(2)} (independent recompute)`,
      actual: `$${offLab.toFixed(2)} (estimation page)`,
    });
  }

  // 4 & 5. Section-level consumables — recomputed from ALL primaries in scope
  // (glue/feather finish are shared across sheet + plank rows, not plank-only)
  const totalArea = primaries.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const gluableArea = primaries.filter((p) => !isFloating(p.product_type)).reduce((s, p) => s + (Number(p.qty) || 0), 0);

  const glueRow = sectionRows.find((r) => r.description === "Glue Sheet/Plank");
  if (gluableArea > 0) {
    const expectedQty = Math.ceil(gluableArea / COVERAGE_M2);
    findings.push({
      level: glueRow && Number(glueRow.qty) === expectedQty ? "pass" : "fail",
      itemLabel: "Section",
      check: "Glue Sheet/Plank qty (excludes floating planks)",
      expected: `${expectedQty} drum(s) — ceil(${gluableArea} / ${COVERAGE_M2})`,
      actual: glueRow ? `${glueRow.qty} drum(s)` : "row missing",
    });
  } else if (glueRow) {
    findings.push({
      level: "warn",
      itemLabel: "Section",
      check: "Glue Sheet/Plank present with zero gluable area",
      expected: "no row expected (all rows are floating planks or empty)",
      actual: `${glueRow.qty} drum(s) present`,
    });
  }

  const ffMatRow = sectionRows.find((r) => r.description === "Feather Finish 20kg");
  const ffLabRow = sectionRows.find((r) => r.description === "Feather Finish Labour");
  if (totalArea > 0) {
    const expectedBags = Math.ceil(totalArea / COVERAGE_M2);
    findings.push({
      level: ffMatRow && Number(ffMatRow.qty) === expectedBags ? "pass" : "fail",
      itemLabel: "Section",
      check: "Feather Finish 20kg qty",
      expected: `${expectedBags} bag(s) — ceil(${totalArea} / ${COVERAGE_M2})`,
      actual: ffMatRow ? `${ffMatRow.qty} bag(s)` : "row missing",
    });
    findings.push({
      level: ffLabRow && Number(ffLabRow.qty) === totalArea ? "pass" : "fail",
      itemLabel: "Section",
      check: "Feather Finish Labour qty",
      expected: `${totalArea} m²`,
      actual: ffLabRow ? `${ffLabRow.qty} m²` : "row missing",
    });
  }

  // 6. Scope-wide total: independently sum every item (primaries + per-item
  // children + section consumables) and cross-check against what the page shows.
  const independentMat = scopeItems.reduce((s, i) => s + recomputeMaterialCost(i), 0);
  const independentLab = scopeItems.reduce((s, i) => s + recomputeLabourCost(i), 0);

  if (displayedScopeTotal) {
    findings.push({
      level: close(independentMat, displayedScopeTotal.mat) ? "pass" : "fail",
      itemLabel: "Scope total",
      check: "Material cost — scope total cross-check",
      expected: `$${independentMat.toFixed(2)} (independent sum)`,
      actual: `$${displayedScopeTotal.mat.toFixed(2)} (estimation page)`,
    });
    findings.push({
      level: close(independentLab, displayedScopeTotal.lab) ? "pass" : "fail",
      itemLabel: "Scope total",
      check: "Labour cost — scope total cross-check",
      expected: `$${independentLab.toFixed(2)} (independent sum)`,
      actual: `$${displayedScopeTotal.lab.toFixed(2)} (estimation page)`,
    });
  }

  return {
    scope,
    findings,
    independentTotals: { mat: independentMat, lab: independentLab, total: independentMat + independentLab },
  };
}

// Sanity re-check on itemTotal, used by the audit modal to make sure the
// scope's grand total is internally consistent (mat + lab == total for every row).
export function auditItemTotalsInternal(items: EstimateItem[], scope: string): AuditFinding[] {
  return items
    .filter((i) => i.scope_category === scope)
    .filter((i) => !close(itemMatCost(i) + itemLabCost(i), itemTotal(i)))
    .map((i) => ({
      level: "fail" as const,
      itemLabel: i.finish_code || i.description || `#${i.id.slice(0, 8)}`,
      check: "itemTotal() internal consistency",
      expected: `$${(itemMatCost(i) + itemLabCost(i)).toFixed(2)} (mat + lab)`,
      actual: `$${itemTotal(i).toFixed(2)} (itemTotal())`,
    }));
}
