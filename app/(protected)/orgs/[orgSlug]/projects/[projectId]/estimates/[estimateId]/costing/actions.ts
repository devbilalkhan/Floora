"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAuthedClient } from "@/lib/supabase/server";
import type { EstimateItem, EstimateSettings, WetArea } from "@/lib/estimate-types";
import { MAT as MAT_DEFAULTS, LAB as LAB_DEFAULTS, COVERAGE_M2 as COVERAGE, FILLET_LM } from "@/lib/default-rates";

const ESTIMATE_ITEMS_COLS =
  "id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, qty_manually_set, manufacturer, level, product_type, included_in_totals";

const TAKEOFF_ROW_COLS =
  "id, takeoff_id, scope_category, finish_code, description, manufacturer, colour, location, level, product_type, qty, unit, waste_pct, notes, sort_order, parent_finish_code, cove_height_mm";

// ── Authorization guards ───────────────────────────────────────────────────────
// These use the RLS-respecting user client to verify access before proceeding
// with the service-role client in the calling action.

async function assertEstimateAccess(estimateId: string): Promise<void> {
  const { data } = await createClient().from("estimates").select("id").eq("id", estimateId).single();
  if (!data) throw new Error("Estimate not found or access denied.");
}

async function assertItemAccess(itemId: string): Promise<void> {
  const { data } = await createClient().from("estimate_items").select("id").eq("id", itemId).single();
  if (!data) throw new Error("Item not found or access denied.");
}

async function assertWetAreaAccess(id: string): Promise<void> {
  const { data } = await createClient().from("estimate_wet_areas").select("id").eq("id", id).single();
  if (!data) throw new Error("Wet area not found or access denied.");
}

async function getEffectiveRates(estimateId: string): Promise<{ MAT: Record<string, number>; LAB: Record<string, number> }> {
  const { supabase } = await createAuthedClient();
  const { data: est } = await supabase.from("estimates").select("project_id").eq("id", estimateId).single();
  if (!est) return { MAT: { ...MAT_DEFAULTS }, LAB: { ...LAB_DEFAULTS } };
  const { data: proj } = await supabase.from("projects").select("organizations(default_rates)").eq("id", est.project_id).single();
  const orgRates = (proj as any)?.organizations as { default_rates?: { mat?: Record<string, number>; lab?: Record<string, number> } } | null;
  return {
    MAT: { ...MAT_DEFAULTS, ...(orgRates?.default_rates?.mat ?? {}) },
    LAB: { ...LAB_DEFAULTS, ...(orgRates?.default_rates?.lab ?? {}) },
  };
}

// Product type helpers
const isPlank = (t: string | null | undefined) => t === "plank_glued" || t === "plank_floating";
const isFloating = (t: string | null | undefined) => t === "plank_floating";

function ceil(n: number) {
  return Math.ceil(n);
}

// ── Import takeoff into estimate ───────────────────────────────────────────────
export async function importTakeoff(estimateId: string, takeoffId: string, orgSlug: string, projectId: string) {
  await assertEstimateAccess(estimateId);
  const [{ supabase }, { MAT, LAB }] = await Promise.all([createAuthedClient(), getEffectiveRates(estimateId)]);

  // Load all takeoff rows
  const { data: rows, error: rowErr } = await supabase
    .from("project_takeoff")
    .select(TAKEOFF_ROW_COLS)
    .eq("takeoff_id", takeoffId)
    .order("sort_order");

  if (rowErr) throw new Error(rowErr.message);
  if (!rows || rows.length === 0) return;

  // Clear existing items for a clean re-import
  await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);

  // Separate linked covings (will be merged into parent vinyl rows)
  const linkedCovings = rows.filter(
    (r) => r.scope_category === "coving_skirting" && r.parent_finish_code && r.cove_height_mm
  );
  const covingsByParent: Record<string, typeof linkedCovings> = {};
  for (const c of linkedCovings) {
    // Key is level-aware so L1 and L2 covings for the same finish code don't cross-contaminate
    const key = `${(c.parent_finish_code as string).toUpperCase()}::${c.level ?? ""}`;
    if (!covingsByParent[key]) covingsByParent[key] = [];
    covingsByParent[key].push(c);
  }
  const linkedCovingIds = new Set(linkedCovings.map((c) => c.id));

  // Primary rows = everything except linked covings
  // Rows that share the same scope_category + finish_code are consolidated (qty summed)
  const rawPrimaryRows = rows.filter((r) => !linkedCovingIds.has(r.id));
  const primaryRows: typeof rawPrimaryRows = [];
  const consolidatedKeys = new Map<string, number>(); // key → index in primaryRows

  for (const row of rawPrimaryRows) {
    const code = row.finish_code as string | null;
    if (code) {
      // Include level in key so same finish code on different levels stays separate
      const key = `${row.scope_category}::${code.toUpperCase()}::${row.level ?? ""}`;
      if (consolidatedKeys.has(key)) {
        const idx = consolidatedKeys.get(key)!;
        primaryRows[idx] = {
          ...primaryRows[idx],
          qty: Number(primaryRows[idx].qty) + Number(row.qty),
        };
      } else {
        consolidatedKeys.set(key, primaryRows.length);
        primaryRows.push({ ...row });
      }
    } else {
      // No finish code — keep as its own row
      primaryRows.push({ ...row });
    }
  }

  let sortOrder = 0;

  for (const row of primaryRows) {
    const scope = row.scope_category as string;
    const unit = row.unit as string;
    const qty = Number(row.qty) || 0;
    const finishCode = (row.finish_code as string | null)?.toUpperCase() ?? null;

    // Merge linked covings for vinyl / wall_vinyl rows
    let covLm: number | null = null;
    let covArea: number | null = null;
    let covHeightMm: number | null = null;

    const covKey = finishCode ? `${finishCode}::${row.level ?? ""}` : null;
    if ((scope === "vinyl" || scope === "wall_vinyl") && covKey && covingsByParent[covKey]) {
      const covings = covingsByParent[covKey];
      covLm = covings.reduce((s, c) => s + Number(c.qty), 0);
      // Use the first cove_height_mm (all should match; user can edit if not)
      covHeightMm = Number(covings[0].cove_height_mm) || null;
      covArea = covHeightMm && covLm ? covLm * (covHeightMm / 1000) : 0;
      if (covArea === 0) { covLm = null; covArea = null; }
    }

    // Determine labour rate for primary row
    let labRate = 0;
    if (scope === "vinyl") labRate = LAB.vinyl;
    else if (scope === "wall_vinyl") labRate = LAB.wallVinyl;
    else if (scope === "carpet") labRate = unit === "blm" ? LAB.carpetBlm : LAB.carpet;
    else if (scope === "stairs") labRate = LAB.stairs;
    else if (scope === "transition") labRate = LAB.transition;
    else if (scope === "coving_skirting") {
      // standalone vinyl skirting (no height) vs standalone coved skirting (has height)
      labRate = row.cove_height_mm ? LAB.coving : LAB.vinylSkirting;
    }

    // Material rate for vinyl skirting and trims
    let matRate = 0;
    if (scope === "coving_skirting" && !row.cove_height_mm) matRate = MAT.vinylSkirting;
    if (scope === "transition") matRate = MAT.trims;

    // Insert primary item
    const { data: primary, error: primErr } = await supabase
      .from("estimate_items")
      .insert({
        estimate_id: estimateId,
        sort_order: sortOrder++,
        type: "primary",
        scope_category: scope,
        finish_code: row.finish_code,
        description: row.colour ? `${row.description ?? ""} — ${row.colour}`.trim() : row.description,
        manufacturer: row.manufacturer ?? null,
        qty,
        unit,
        waste_pct: Number(row.waste_pct) || 0,
        cov_lm: covLm,
        cov_area: covArea,
        cov_height_mm: covHeightMm,
        mat_rate: matRate,
        lab_rate: labRate,
        is_auto: false,
        level: row.level ?? null,
        product_type: row.product_type ?? null,
      })
      .select("id")
      .single();

    if (primErr || !primary) continue;
    const parentId = primary.id as string;

    // ── Auto-generate consumable children ─────────────────────────────────────
    const children: Omit<EstimateItem, "id" | "created_at" | "updated_at" | "level" | "product_type">[] = [];
    const floorArea = qty; // base floor area (no coving) for adhesive/ff calculations

    const productType = row.product_type as string | null;

    if (scope === "vinyl" || scope === "wall_vinyl") {
      const base = {
        estimate_id: estimateId, parent_item_id: parentId,
        type: "consumable" as const, scope_category: scope,
        finish_code: null, waste_pct: 0,
        cov_lm: null, cov_area: null, cov_height_mm: null,
        manufacturer: null, is_auto: true, qty_manually_set: false, level: null, included_in_totals: true,
      };

      // Weld rod — sheet only (planks are clicked/glued, not welded)
      // Glue + Feather Finish are consolidated at section level via syncSectionConsumables
      if (floorArea > 0 && !isPlank(productType)) {
        children.push({ ...base, sort_order: sortOrder++, description: "Weld Rod", qty: ceil(floorArea / 2), unit: "lm", mat_rate: MAT.weldRod, lab_rate: 0, coverage_m2: 2 });
      }

      // Coving — sheet only (planks cannot cove)
      if (!isPlank(productType) && covLm && covArea && covArea > 0) {
        children.push({ ...base, sort_order: sortOrder++, description: "Contact Brushable (Max Bond 102)", qty: ceil(covArea / COVERAGE), unit: "drum",  mat_rate: MAT.contactBrushable, lab_rate: 0,          coverage_m2: COVERAGE });
        children.push({ ...base, sort_order: sortOrder++, description: "Cove Fillet",                      qty: ceil(covLm / FILLET_LM), unit: "coil",  mat_rate: MAT.coveFillet,        lab_rate: 0,          coverage_m2: null     });
        children.push({ ...base, sort_order: sortOrder++, description: "Coving Labour",                    qty: covLm,                   unit: "lm",    mat_rate: 0,                     lab_rate: LAB.coving, coverage_m2: null     });
      }
    } else if (scope === "carpet") {
      const base = {
        estimate_id: estimateId, parent_item_id: parentId,
        type: "consumable" as const, scope_category: scope,
        finish_code: null, waste_pct: 0,
        cov_lm: null, cov_area: null, cov_height_mm: null,
        manufacturer: null, is_auto: true, qty_manually_set: false, level: null, included_in_totals: true,
      };

      // Glue Carpet is consolidated at section level via syncSectionConsumables

      // Underlay — broadloom only (not tiles)
      if (!productType || productType === "broadloom") {
        children.push({ ...base, sort_order: sortOrder++, description: "Carpet Underlay", qty: floorArea, unit: "m2", mat_rate: MAT.underlay, lab_rate: 0, coverage_m2: null });
      }
    } else if (scope === "coving_skirting" && row.cove_height_mm) {
      // Standalone coved skirting (no parent link)
      const area = qty * (Number(row.cove_height_mm) / 1000);

      children.push({
        estimate_id: estimateId,
        parent_item_id: parentId,
        sort_order: sortOrder++,
        type: "consumable",
        scope_category: scope,
        finish_code: null,
        description: "Contact Brushable (Max Bond 102)",
        qty: ceil(area / COVERAGE),
        unit: "drum",
        waste_pct: 0,
        cov_lm: null,
        cov_area: null,
        cov_height_mm: null,
        mat_rate: MAT.contactBrushable,
        lab_rate: 0,
        coverage_m2: COVERAGE,
        manufacturer: null,
        is_auto: true,
        qty_manually_set: false,
        included_in_totals: true,
      });

      children.push({
        estimate_id: estimateId,
        parent_item_id: parentId,
        sort_order: sortOrder++,
        type: "consumable",
        scope_category: scope,
        finish_code: null,
        description: "Cove Fillet",
        qty: ceil(qty / FILLET_LM),
        unit: "coil",
        waste_pct: 0,
        cov_lm: null,
        cov_area: null,
        cov_height_mm: null,
        mat_rate: MAT.coveFillet,
        lab_rate: 0,
        coverage_m2: null,
        manufacturer: null,
        is_auto: true,
        qty_manually_set: false,
        included_in_totals: true,
      });
    }

    if (children.length > 0) {
      await supabase.from("estimate_items").insert(children);
    }
  }

  // Build section-level consumables (Glue [+ FF for vinyl]) for each scope that
  // consolidates them — floating vinyl planks are excluded from gluableArea,
  // carpet has no floating product type so gluableArea === totalArea there.
  for (const sc of ["vinyl", "wall_vinyl", "carpet"] as const) {
    const { data: vp } = await supabase
      .from("estimate_items")
      .select("qty, product_type")
      .eq("estimate_id", estimateId)
      .eq("scope_category", sc)
      .eq("type", "primary");
    const rows = vp ?? [];
    const totalArea   = rows.reduce((s, p) => s + (Number(p.qty) || 0), 0);
    const gluableArea = rows.filter(p => !isFloating(p.product_type)).reduce((s, p) => s + (Number(p.qty) || 0), 0);
    if (totalArea > 0 || gluableArea > 0) {
      await syncSectionConsumables(estimateId, sc, totalArea, gluableArea);
    }
  }

  // Update estimate to record the source takeoff
  await supabase
    .from("estimates")
    .update({ source_takeoff_id: takeoffId })
    .eq("id", estimateId);

  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/costing`);
}

// ── Update a single estimate item field ───────────────────────────────────────
export async function updateEstimateItem(
  itemId: string,
  patch: Partial<Pick<EstimateItem, "finish_code" | "description" | "qty" | "unit" | "waste_pct" | "mat_rate" | "lab_rate" | "coverage_m2" | "manufacturer" | "qty_manually_set" | "included_in_totals">>
) {
  await assertItemAccess(itemId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_items").update(patch).eq("id", itemId);
  if (error) throw new Error(error.message);
}

// ── Delete an estimate item (and its children via cascade) ────────────────────
export async function deleteEstimateItem(itemId: string) {
  await assertItemAccess(itemId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

// ── Build auto-consumable children for a manual row (no coving) ──────────────
function buildAutoChildren(
  estimateId: string,
  parentId: string,
  scopeCategory: string,
  startOrder: number,
  productType: string | null = null,
  rates: { MAT: Record<string, number>; LAB: Record<string, number> } = { MAT: MAT_DEFAULTS, LAB: LAB_DEFAULTS }
): Omit<EstimateItem, "id" | "created_at" | "updated_at">[] {
  const { MAT, LAB } = rates;
  const children: Omit<EstimateItem, "id" | "created_at" | "updated_at">[] = [];
  let order = startOrder;

  const base = {
    estimate_id: estimateId,
    parent_item_id: parentId,
    scope_category: scopeCategory,
    type: "consumable" as const,
    finish_code: null,
    qty: 0,
    waste_pct: 0,
    cov_lm: null,
    cov_area: null,
    cov_height_mm: null,
    manufacturer: null,
    is_auto: true,
    qty_manually_set: false,
    level: null,
    product_type: null,
    included_in_totals: true,
  };

  if (scopeCategory === "vinyl" || scopeCategory === "wall_vinyl") {
    // Glue + Feather Finish are consolidated at section level via syncSectionConsumables
    if (!isPlank(productType)) {
      children.push({ ...base, sort_order: order++, description: "Weld Rod", unit: "lm", mat_rate: MAT.weldRod, lab_rate: 0, coverage_m2: 2 });
    }
  } else if (scopeCategory === "carpet") {
    // Glue Carpet is consolidated at section level via syncSectionConsumables
    if (!productType || productType === "broadloom") {
      children.push({ ...base, sort_order: order++, description: "Carpet Underlay", unit: "m2", mat_rate: MAT.underlay, lab_rate: 0, coverage_m2: null });
    }
  }
  // coving_skirting, stairs, transition, matting: no auto children on manual add

  return children;
}

// ── Add a primary row with auto-consumable children ───────────────────────────
export async function addEstimateItem(
  estimateId: string,
  scopeCategory: string,
  sortOrder: number,
  productType: string | null = null
): Promise<{ primary: EstimateItem; children: EstimateItem[] }> {
  await assertEstimateAccess(estimateId);
  const [{ supabase }, rates] = await Promise.all([createAuthedClient(), getEffectiveRates(estimateId)]);
  const { MAT, LAB } = rates;

  const unit =
    scopeCategory === "coving_skirting" || scopeCategory === "transition" || scopeCategory === "stairs"
      ? "ea"
    : scopeCategory === "carpet" && productType === "broadloom"
      ? "blm"
      : "m2";

  const labRate =
    scopeCategory === "vinyl"         ? LAB.vinyl
    : scopeCategory === "wall_vinyl"  ? LAB.wallVinyl
    : scopeCategory === "carpet"      ? (unit === "blm" ? LAB.carpetBlm : LAB.carpet)
    : scopeCategory === "stairs"      ? LAB.stairs
    : scopeCategory === "transition"  ? LAB.transition
    : scopeCategory === "coving_skirting" ? LAB.vinylSkirting
    : 0;

  const matRate =
    scopeCategory === "transition"        ? MAT.trims
    : scopeCategory === "coving_skirting" ? MAT.vinylSkirting
    : 0;

  const { data: primary, error } = await supabase
    .from("estimate_items")
    .insert({ estimate_id: estimateId, sort_order: sortOrder, type: "primary", scope_category: scopeCategory, qty: 0, unit, waste_pct: 0, mat_rate: matRate, lab_rate: labRate, is_auto: false, product_type: productType })
    .select(ESTIMATE_ITEMS_COLS)
    .single();
  if (error) throw new Error(error.message);

  const childDefs = buildAutoChildren(estimateId, primary.id, scopeCategory, sortOrder + 1, productType, rates);
  let children: EstimateItem[] = [];
  if (childDefs.length > 0) {
    const { data: childRows } = await supabase.from("estimate_items").insert(childDefs).select(ESTIMATE_ITEMS_COLS);
    children = (childRows ?? []) as EstimateItem[];
  }

  return { primary: primary as EstimateItem, children };
}

// Coving-specific descriptions — excluded from floor-area-based qty sync
const COVING_DESCS = new Set([
  "Contact Brushable (Max Bond 102)",
  "Cove Fillet",
  "Coving Labour",
]);

// ── Recalculate auto-consumable qtys when a primary row's qty changes ─────────
export async function syncAutoConsumables(parentId: string, parentQty: number) {
  await assertItemAccess(parentId);
  const { supabase } = await createAuthedClient();
  const { data: children } = await supabase
    .from("estimate_items")
    .select("id, coverage_m2, unit, description, qty_manually_set")
    .eq("parent_item_id", parentId)
    .eq("is_auto", true);

  if (!children || children.length === 0) return;

  // Exclude coving children (qty depends on coving geometry, not floor area)
  // and rows the user has manually corrected — don't clobber their override.
  const syncable = children.filter(c => !COVING_DESCS.has(c.description ?? "") && !c.qty_manually_set);
  if (syncable.length === 0) return;

  await Promise.all(
    syncable.map(c => {
      const newQty = c.coverage_m2 ? Math.ceil(parentQty / c.coverage_m2) : parentQty;
      return supabase.from("estimate_items").update({ qty: newQty }).eq("id", c.id);
    })
  );
}

// ── Add / replace coving children on a vinyl primary row ─────────────────────
export async function addCovingToItem(
  primaryId: string,
  estimateId: string,
  scopeCategory: string,
  covLm: number,
  covHeightMm: number,
  startSortOrder: number
): Promise<EstimateItem[]> {
  await assertEstimateAccess(estimateId);
  const [{ supabase }, { MAT, LAB }] = await Promise.all([createAuthedClient(), getEffectiveRates(estimateId)]);
  const covArea = covLm * (covHeightMm / 1000);

  // Update cov fields on the primary item
  await supabase.from("estimate_items")
    .update({ cov_lm: covLm, cov_area: covArea, cov_height_mm: covHeightMm })
    .eq("id", primaryId);

  // Remove any existing coving children before re-inserting
  await supabase.from("estimate_items")
    .delete()
    .eq("parent_item_id", primaryId)
    .in("description", Array.from(COVING_DESCS));

  const base = {
    estimate_id: estimateId,
    parent_item_id: primaryId,
    scope_category: scopeCategory,
    type: "consumable" as const,
    finish_code: null,
    qty: 0,
    waste_pct: 0,
    cov_lm: null, cov_area: null, cov_height_mm: null,
    manufacturer: null,
    is_auto: true,
    qty_manually_set: false,
    level: null,
    product_type: null,
  };

  const { data } = await supabase.from("estimate_items").insert([
    { ...base, sort_order: startSortOrder,     description: "Contact Brushable (Max Bond 102)", unit: "drum", mat_rate: MAT.contactBrushable, lab_rate: 0,          coverage_m2: COVERAGE,   qty: ceil(covArea / COVERAGE) },
    { ...base, sort_order: startSortOrder + 1, description: "Cove Fillet",                      unit: "coil", mat_rate: MAT.coveFillet,        lab_rate: 0,          coverage_m2: null,       qty: ceil(covLm / FILLET_LM) },
    { ...base, sort_order: startSortOrder + 2, description: "Coving Labour",                    unit: "lm",   mat_rate: 0,                     lab_rate: LAB.coving, coverage_m2: null,       qty: covLm },
  ]).select(ESTIMATE_ITEMS_COLS);

  return (data ?? []) as EstimateItem[];
}

// ── Remove coving from a vinyl primary row ────────────────────────────────────
export async function removeCovingFromItem(primaryId: string): Promise<void> {
  await assertItemAccess(primaryId);
  const { supabase } = await createAuthedClient();

  await supabase.from("estimate_items")
    .update({ cov_lm: null, cov_area: null, cov_height_mm: null })
    .eq("id", primaryId);

  await supabase.from("estimate_items")
    .delete()
    .eq("parent_item_id", primaryId)
    .in("description", Array.from(COVING_DESCS));
}

// ── Restore any missing auto-consumable children on a primary row ─────────────
export async function restoreAutoConsumables(
  primaryId: string,
  estimateId: string,
  scopeCategory: string,
  parentQty: number,
  only?: string
): Promise<EstimateItem[]> {
  await assertEstimateAccess(estimateId);
  const [{ supabase }, rates] = await Promise.all([createAuthedClient(), getEffectiveRates(estimateId)]);

  const { data: existing } = await supabase
    .from("estimate_items")
    .select("description, sort_order")
    .eq("parent_item_id", primaryId)
    .eq("is_auto", true);

  const existingDescs = new Set((existing ?? []).map((c) => c.description as string));
  const maxOrder = (existing ?? []).reduce((m, c) => Math.max(m, c.sort_order as number), 0);

  const allExpected = buildAutoChildren(estimateId, primaryId, scopeCategory, maxOrder + 1, null, rates);
  const missing = allExpected.filter((c) => !existingDescs.has(c.description ?? "") && (!only || c.description === only));
  if (missing.length === 0) return [];

  // Apply correct qty based on parent qty (mirrors calcAutoChildQty logic)
  const withQty = missing.map((c) => ({
    ...c,
    qty: c.coverage_m2
      ? Math.ceil(parentQty / c.coverage_m2)
      : c.unit === "m2"
      ? parentQty
      : 0,
  }));

  const { data } = await supabase.from("estimate_items").insert(withQty).select(ESTIMATE_ITEMS_COLS);
  return (data ?? []) as EstimateItem[];
}

// ── Sync section-level consumables for a scope ────────────────────────────────
// These rows have parent_item_id = null and are consolidated across all primary
// items in the section (vinyl/wall_vinyl: Glue + Feather Finish; carpet: Glue).
// Called after any primary qty change, add, or delete in a consolidating scope.
export async function syncSectionConsumables(
  estimateId: string,
  scopeCategory: string,
  totalArea: number,
  gluableArea: number,
  force: string[] = []
): Promise<EstimateItem[]> {
  await assertEstimateAccess(estimateId);
  const [{ supabase }, { MAT, LAB }] = await Promise.all([createAuthedClient(), getEffectiveRates(estimateId)]);

  // Build expected rows
  const expected = new Map<string, { qty: number; sort_order: number; unit: string; mat_rate: number; lab_rate: number; coverage_m2: number | null }>();
  if (scopeCategory === "carpet") {
    if (gluableArea > 0 || force.includes("Glue Carpet")) {
      expected.set("Glue Carpet", { qty: ceil(gluableArea / COVERAGE), sort_order: 9000, unit: "drum", mat_rate: MAT.glueCarpet, lab_rate: 0, coverage_m2: COVERAGE });
    }
  } else {
    if (gluableArea > 0 || force.includes("Glue Sheet/Plank")) {
      expected.set("Glue Sheet/Plank",     { qty: ceil(gluableArea / COVERAGE), sort_order: 9000, unit: "drum", mat_rate: MAT.glueSheet,     lab_rate: 0,                 coverage_m2: COVERAGE });
    }
    if (totalArea > 0 || force.includes("Feather Finish 20kg")) {
      expected.set("Feather Finish 20kg",  { qty: ceil(totalArea  / COVERAGE), sort_order: 9001, unit: "bag",  mat_rate: MAT.featherFinish, lab_rate: 0,                 coverage_m2: COVERAGE });
      expected.set("Feather Finish Labour", { qty: totalArea,                   sort_order: 9002, unit: "m2",  mat_rate: 0,                 lab_rate: LAB.featherFinish, coverage_m2: null     });
    }
  }

  // Fetch existing section-level consumables for this scope (used for
  // deletion + to skip a round-trip when a row's qty hasn't changed)
  const { data: existing } = await supabase
    .from("estimate_items")
    .select(ESTIMATE_ITEMS_COLS)
    .eq("estimate_id", estimateId)
    .eq("scope_category", scopeCategory)
    .eq("is_auto", true)
    .is("parent_item_id", null);

  const existingMap = new Map((existing ?? []).map((r) => [r.description as string, r as EstimateItem]));

  const toDelete = (existing ?? [])
    .filter((r) => !expected.has(r.description as string))
    .map((r) => r.id);

  // Insert-or-update each expected row atomically via upsert_section_consumable
  // (partial-unique-index + ON CONFLICT in the DB — see migration 060). This
  // avoids the read-then-write race the previous select/insert split had,
  // where two overlapping calls could both see "no row yet" and both insert.
  const [upserted] = await Promise.all([
    Promise.all(
      Array.from(expected.entries()).map(async ([desc, row]) => {
        const ex = existingMap.get(desc);
        if (ex && Number(ex.qty) === row.qty) return ex;
        // User manually corrected this row's qty — don't overwrite it.
        if (ex && ex.qty_manually_set) return ex;
        const { data, error } = await supabase.rpc("upsert_section_consumable", {
          p_estimate_id: estimateId,
          p_scope_category: scopeCategory,
          p_description: desc,
          p_qty: row.qty,
          p_sort_order: row.sort_order,
          p_unit: row.unit,
          p_mat_rate: row.mat_rate,
          p_lab_rate: row.lab_rate,
          p_coverage_m2: row.coverage_m2,
        });
        if (error) throw error;
        return data as EstimateItem;
      })
    ),
    toDelete.length > 0 ? supabase.from("estimate_items").delete().in("id", toDelete) : Promise.resolve(),
  ]);

  return upserted;
}

// ── Wet area CRUD ─────────────────────────────────────────────────────────────
export async function addWetArea(estimateId: string, sortOrder: number): Promise<WetArea> {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();
  const { data, error } = await supabase
    .from("estimate_wet_areas")
    .insert({ estimate_id: estimateId, sort_order: sortOrder, name: "Wet Area" })
    .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
    .single();
  if (error) throw new Error(error.message);
  return data as WetArea;
}

export async function updateWetArea(
  id: string,
  patch: Partial<Pick<WetArea, "name" | "floor_sqm" | "wall_semi_sqm" | "wall_full_sqm" | "coving_lm" | "qty" | "charge">>
) {
  await assertWetAreaAccess(id);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_wet_areas").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWetArea(id: string) {
  await assertWetAreaAccess(id);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_wet_areas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Update estimate status ────────────────────────────────────────────────────
export async function updateEstimateStatus(estimateId: string, status: string) {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimates").update({ status }).eq("id", estimateId);
  if (error) throw new Error(error.message);
}

// ── Update estimate notes ─────────────────────────────────────────────────────
export async function updateEstimateNotes(estimateId: string, notes: string) {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase
    .from("estimates")
    .update({ description: notes || null })
    .eq("id", estimateId);
  if (error) throw new Error(error.message);
}

// ── Update estimate-level settings ───────────────────────────────────────────
export async function updateEstimateSettings(
  estimateId: string,
  patch: Partial<EstimateSettings>
) {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimates").update(patch).eq("id", estimateId);
  if (error) throw new Error(error.message);
}

// ── Estimate attachments ──────────────────────────────────────────────────────

const ATTACHMENT_BUCKET = "project-documents";
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
];

export type EstimateAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
};

export async function uploadEstimateAttachment(
  estimateId: string,
  projectId: string,
  formData: FormData,
): Promise<EstimateAttachment> {
  await assertEstimateAccess(estimateId);
  const { supabase, user } = await createAuthedClient();

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided.");
  if (!ALLOWED_MIME_TYPES.includes(file.type))
    throw new Error("File type not supported. Upload a PDF, Excel, Word, image, or CSV.");
  if (file.size > 20 * 1024 * 1024) throw new Error("File too large. Maximum size is 20 MB.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `estimate-attachments/${estimateId}/${Date.now()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: dbError } = await supabase
    .from("estimate_attachments")
    .insert({
      estimate_id: estimateId,
      project_id: projectId,
      name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      created_by: user.id,
    })
    .select("id, name, mime_type, size_bytes, created_at")
    .single();
  if (dbError) throw new Error(dbError.message);
  return data;
}

export async function getEstimateAttachmentUrl(attachmentId: string, estimateId: string): Promise<string> {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();

  const { data: row } = await supabase
    .from("estimate_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();
  if (!row) throw new Error("Attachment not found.");

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, 3600);
  if (error || !data?.signedUrl) throw new Error("Failed to generate URL.");
  return data.signedUrl;
}

export async function deleteEstimateAttachment(attachmentId: string, estimateId: string): Promise<void> {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();

  const { data: row } = await supabase
    .from("estimate_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();
  if (!row) throw new Error("Attachment not found.");

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.storage_path]);
  await supabase.from("estimate_attachments").delete().eq("id", attachmentId);
}

// ── Full reset — wipe an estimate's contents back to a blank slate ────────────
// Deletes every line item, wet area, and attachment, and resets rates/mark-up/
// freight/floor-prep/grind settings to their DB defaults. Irreversible — the
// caller is responsible for confirming with the user before invoking this.
export async function resetEstimate(estimateId: string): Promise<void> {
  await assertEstimateAccess(estimateId);
  const { supabase } = await createAuthedClient();

  const { data: attachments } = await supabase
    .from("estimate_attachments")
    .select("storage_path")
    .eq("estimate_id", estimateId);
  if (attachments && attachments.length > 0) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove(attachments.map((a) => a.storage_path));
  }

  await Promise.all([
    supabase.from("estimate_items").delete().eq("estimate_id", estimateId),
    supabase.from("estimate_wet_areas").delete().eq("estimate_id", estimateId),
    supabase.from("estimate_attachments").delete().eq("estimate_id", estimateId),
  ]);

  await supabase
    .from("estimates")
    .update({
      source_takeoff_id: null,
      accounting_rate: 0.02,
      admin_rate: 0.05,
      net_markup_pct: 0.23,
      freight: 0,
      accommodation: 0,
      travel_allowance: 0,
      bailing_fee: 0,
      floor_prep_area: 0,
      floor_prep_depth_mm: 3,
      floor_prep_charge_per_bag: 0,
      floor_prep_mat_per_bag: 33,
      floor_prep_lab_per_bag: 40,
      grind_area: 0,
      grind_labor_rate: 0,
      grind_charge_rate: 0,
    })
    .eq("id", estimateId);
}
