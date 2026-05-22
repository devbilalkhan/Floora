"use server";

import { revalidatePath } from "next/cache";
import { createAuthedClient } from "@/lib/supabase/server";
import type { EstimateItem, EstimateSettings, WetArea } from "@/lib/estimate-types";
import { MAT, LAB, COVERAGE_M2 as COVERAGE, FILLET_LM } from "@/lib/default-rates";

// Product type helpers
const isPlank = (t: string | null | undefined) => t === "plank_glued" || t === "plank_floating";
const isFloating = (t: string | null | undefined) => t === "plank_floating";

function ceil(n: number) {
  return Math.ceil(n);
}

// ── Import takeoff into estimate ───────────────────────────────────────────────
export async function importTakeoff(estimateId: string, takeoffId: string, orgSlug: string, projectId: string) {
  const { supabase } = await createAuthedClient();

  // Load all takeoff rows
  const { data: rows, error: rowErr } = await supabase
    .from("project_takeoff")
    .select("*")
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
        description: row.description,
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
        manufacturer: null, is_auto: true, level: null,
      };

      // Glue — sheet and plank_glued only (not floating)
      if (!isFloating(productType)) {
        children.push({ ...base, sort_order: sortOrder++, description: "Glue Sheet/Plank", qty: ceil(floorArea / COVERAGE), unit: "drum", mat_rate: MAT.glueSheet, lab_rate: 0, coverage_m2: COVERAGE });
      }

      if (floorArea > 0) {
        children.push({ ...base, sort_order: sortOrder++, description: "Feather Finish 20kg",   qty: ceil(floorArea / COVERAGE), unit: "bag", mat_rate: MAT.featherFinish, lab_rate: 0,                 coverage_m2: COVERAGE });
        children.push({ ...base, sort_order: sortOrder++, description: "Feather Finish Labour",  qty: floorArea,                  unit: "m2",  mat_rate: 0,                 lab_rate: LAB.featherFinish, coverage_m2: null     });

        // Weld rod — sheet only (planks are clicked/glued, not welded)
        if (!isPlank(productType)) {
          children.push({ ...base, sort_order: sortOrder++, description: "Weld Rod", qty: ceil(floorArea / 2), unit: "lm", mat_rate: MAT.weldRod, lab_rate: 0, coverage_m2: 2 });
        }
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
        manufacturer: null, is_auto: true, level: null,
      };

      children.push({ ...base, sort_order: sortOrder++, description: "Glue Carpet", qty: ceil(floorArea / COVERAGE), unit: "drum", mat_rate: MAT.glueCarpet, lab_rate: 0, coverage_m2: COVERAGE });

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
      });
    }

    if (children.length > 0) {
      await supabase.from("estimate_items").insert(children);
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
  patch: Partial<Pick<EstimateItem, "finish_code" | "description" | "qty" | "unit" | "waste_pct" | "mat_rate" | "lab_rate" | "coverage_m2" | "manufacturer">>
) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_items").update(patch).eq("id", itemId);
  if (error) throw new Error(error.message);
}

// ── Delete an estimate item (and its children via cascade) ────────────────────
export async function deleteEstimateItem(itemId: string) {
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
  productType: string | null = null
): Omit<EstimateItem, "id" | "created_at" | "updated_at">[] {
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
    level: null,
    product_type: null,
  };

  if (scopeCategory === "vinyl" || scopeCategory === "wall_vinyl") {
    if (!isFloating(productType)) {
      children.push({ ...base, sort_order: order++, description: "Glue Sheet/Plank",     unit: "drum", mat_rate: MAT.glueSheet,     lab_rate: 0,                 coverage_m2: COVERAGE });
    }
    children.push({ ...base, sort_order: order++, description: "Feather Finish 20kg",  unit: "bag",  mat_rate: MAT.featherFinish, lab_rate: 0,                 coverage_m2: COVERAGE });
    children.push({ ...base, sort_order: order++, description: "Feather Finish Labour", unit: "m2",  mat_rate: 0,                 lab_rate: LAB.featherFinish, coverage_m2: null    });
    if (!isPlank(productType)) {
      children.push({ ...base, sort_order: order++, description: "Weld Rod", unit: "lm", mat_rate: MAT.weldRod, lab_rate: 0, coverage_m2: 2 });
    }
  } else if (scopeCategory === "carpet") {
    children.push({ ...base, sort_order: order++, description: "Glue Carpet", unit: "drum", mat_rate: MAT.glueCarpet, lab_rate: 0, coverage_m2: COVERAGE });
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
  const { supabase } = await createAuthedClient();

  const unit =
    scopeCategory === "coving_skirting" || scopeCategory === "transition" || scopeCategory === "stairs"
      ? "ea"
      : "m2";

  const labRate =
    scopeCategory === "vinyl"         ? LAB.vinyl
    : scopeCategory === "wall_vinyl"  ? LAB.wallVinyl
    : scopeCategory === "carpet"      ? LAB.carpet
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
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const childDefs = buildAutoChildren(estimateId, primary.id, scopeCategory, sortOrder + 1, productType);
  let children: EstimateItem[] = [];
  if (childDefs.length > 0) {
    const { data: childRows } = await supabase.from("estimate_items").insert(childDefs).select("*");
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
  const { supabase } = await createAuthedClient();
  const { data: children } = await supabase
    .from("estimate_items")
    .select("id, coverage_m2, unit, description")
    .eq("parent_item_id", parentId)
    .eq("is_auto", true);

  if (!children || children.length === 0) return;

  // Exclude coving children — their qty depends on coving geometry, not floor area
  const syncable = children.filter(c => !COVING_DESCS.has(c.description ?? ""));
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
  const { supabase } = await createAuthedClient();
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
    level: null,
    product_type: null,
  };

  const { data } = await supabase.from("estimate_items").insert([
    { ...base, sort_order: startSortOrder,     description: "Contact Brushable (Max Bond 102)", unit: "drum", mat_rate: MAT.contactBrushable, lab_rate: 0,          coverage_m2: COVERAGE,   qty: ceil(covArea / COVERAGE) },
    { ...base, sort_order: startSortOrder + 1, description: "Cove Fillet",                      unit: "coil", mat_rate: MAT.coveFillet,        lab_rate: 0,          coverage_m2: null,       qty: ceil(covLm / FILLET_LM) },
    { ...base, sort_order: startSortOrder + 2, description: "Coving Labour",                    unit: "lm",   mat_rate: 0,                     lab_rate: LAB.coving, coverage_m2: null,       qty: covLm },
  ]).select("*");

  return (data ?? []) as EstimateItem[];
}

// ── Remove coving from a vinyl primary row ────────────────────────────────────
export async function removeCovingFromItem(primaryId: string): Promise<void> {
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
  parentQty: number
): Promise<EstimateItem[]> {
  const { supabase } = await createAuthedClient();

  const { data: existing } = await supabase
    .from("estimate_items")
    .select("description, sort_order")
    .eq("parent_item_id", primaryId)
    .eq("is_auto", true);

  const existingDescs = new Set((existing ?? []).map((c) => c.description as string));
  const maxOrder = (existing ?? []).reduce((m, c) => Math.max(m, c.sort_order as number), 0);

  const allExpected = buildAutoChildren(estimateId, primaryId, scopeCategory, maxOrder + 1);
  const missing = allExpected.filter((c) => !existingDescs.has(c.description ?? ""));
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

  const { data } = await supabase.from("estimate_items").insert(withQty).select("*");
  return (data ?? []) as EstimateItem[];
}

// ── Wet area CRUD ─────────────────────────────────────────────────────────────
export async function addWetArea(estimateId: string, sortOrder: number): Promise<WetArea> {
  const { supabase } = await createAuthedClient();
  const { data, error } = await supabase
    .from("estimate_wet_areas")
    .insert({ estimate_id: estimateId, sort_order: sortOrder, name: "Wet Area" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WetArea;
}

export async function updateWetArea(
  id: string,
  patch: Partial<Pick<WetArea, "name" | "floor_sqm" | "wall_semi_sqm" | "wall_full_sqm" | "coving_lm" | "qty" | "charge">>
) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_wet_areas").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWetArea(id: string) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimate_wet_areas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Update estimate status ────────────────────────────────────────────────────
export async function updateEstimateStatus(estimateId: string, status: string) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimates").update({ status }).eq("id", estimateId);
  if (error) throw new Error(error.message);
}

// ── Update estimate-level settings ───────────────────────────────────────────
export async function updateEstimateSettings(
  estimateId: string,
  patch: Partial<EstimateSettings>
) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("estimates").update(patch).eq("id", estimateId);
  if (error) throw new Error(error.message);
}
