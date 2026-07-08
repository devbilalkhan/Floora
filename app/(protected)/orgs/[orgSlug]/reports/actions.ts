"use server";

import { createClient } from "@/lib/supabase/server";
import { computeSummary } from "@/lib/estimate-types";
import type { EstimateItem, EstimateSettings } from "@/lib/estimate-types";
import type { ProjectReportData } from "./report-view";
import type { TimelinePoint } from "./report-charts";

function effSub(item: { qty: number | null; unit_price: number | null; subtotal: number }) {
  return item.qty != null && item.unit_price != null
    ? item.qty * item.unit_price
    : item.subtotal;
}

export async function fetchReportData(
  projectIds: string[]
): Promise<{ reports: ProjectReportData[]; combinedTimeline: TimelinePoint[] }> {
  if (projectIds.length === 0) {
    return { reports: [], combinedTimeline: [] };
  }

  const supabase = createClient();

  // Step 1: estimates
  const { data: estimates } = await supabase
    .from("estimates")
    .select(
      "id, project_id, name, status, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag, grind_area, grind_labor_rate, grind_charge_rate"
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  const estimateIds = (estimates ?? []).map((e) => e.id);

  // Step 2: items + actuals in parallel (also fetch project names)
  const [{ data: allItems }, { data: actualsGroups }, { data: actualsItems }, { data: projectRows }] =
    await Promise.all([
      estimateIds.length
        ? supabase
            .from("estimate_items")
            .select(
              "id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type"
            )
            .in("estimate_id", estimateIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("actual_groups")
        .select("id, project_id, type")
        .in("project_id", projectIds),
      supabase
        .from("actual_line_items")
        .select("group_id, project_id, invoice_date, subtotal, qty, unit_price, included_in_totals")
        .in("project_id", projectIds),
      supabase
        .from("projects")
        .select("id, name, head_client, brand, admin_fee_pct, admin_fee_estimated_cost")
        .in("id", projectIds),
    ]);

  const itemsByEstimate = new Map<string, EstimateItem[]>();
  for (const item of allItems ?? []) {
    const list = itemsByEstimate.get(item.estimate_id) ?? [];
    list.push(item as EstimateItem);
    itemsByEstimate.set(item.estimate_id, list);
  }

  const groupTypeMap = new Map(
    (actualsGroups ?? []).map((g) => [g.id, g.type as "income" | "expense"])
  );

  const projects = projectRows ?? [];

  const reports = projectIds
    .map((pid): ProjectReportData | null => {
      const project = projects.find((p) => p.id === pid);
      if (!project) return null;

      const projectEstimates = (estimates ?? []).filter((e) => e.project_id === pid);
      const best =
        projectEstimates.find((e) => e.status === "approved") ??
        projectEstimates.find((e) => e.status === "submitted") ??
        projectEstimates[0] ??
        null;

      let estRevenue = 0, estCostBase = 0, estOtherCosts = 0, estMargin = 0, estMarginPct = 0;

      if (best) {
        const settings: EstimateSettings = {
          accounting_rate: best.accounting_rate ?? 0,
          admin_rate: best.admin_rate ?? 0,
          net_markup_pct: best.net_markup_pct ?? 0,
          freight: best.freight ?? 0,
          accommodation: best.accommodation ?? 0,
          travel_allowance: best.travel_allowance ?? 0,
          bailing_fee: best.bailing_fee ?? 0,
          floor_prep_area: best.floor_prep_area ?? 0,
          floor_prep_depth_mm: best.floor_prep_depth_mm ?? 3,
          floor_prep_charge_per_bag: best.floor_prep_charge_per_bag ?? 0,
          floor_prep_mat_per_bag: best.floor_prep_mat_per_bag ?? 33,
          floor_prep_lab_per_bag: best.floor_prep_lab_per_bag ?? 40,
          grind_area: best.grind_area ?? 0,
          grind_labor_rate: best.grind_labor_rate ?? 0,
          grind_charge_rate: best.grind_charge_rate ?? 0,
        };
        const s = computeSummary(itemsByEstimate.get(best.id) ?? [], settings);
        estRevenue = s.totalExGst;
        estCostBase = s.base + s.accountingCost + s.adminCost + s.floorPrepCost;
        estOtherCosts = s.additionalCosts;
        estMargin = s.markupAmount + s.floorPrepProfit;
        estMarginPct = s.grossMarginPct;
      }

      const projectActuals = (actualsItems ?? [])
        .filter((i) => i.project_id === pid && i.included_in_totals)
        .map((i) => ({
          ...i,
          type: groupTypeMap.get(i.group_id) ?? ("expense" as "income" | "expense"),
        }));

      const actIncome = projectActuals
        .filter((i) => i.type === "income")
        .reduce((s, i) => s + effSub(i), 0);
      const actCost = projectActuals
        .filter((i) => i.type === "expense")
        .reduce((s, i) => s + effSub(i), 0);
      const adminFeeBase = project.admin_fee_estimated_cost ?? actCost;
      const actAdminFee =
        project.admin_fee_pct != null && project.admin_fee_pct > 0
          ? Math.round(adminFeeBase * (project.admin_fee_pct / 100) * 100) / 100
          : 0;
      const actMargin = actIncome - actCost - actAdminFee;
      const actMarginPct = actIncome > 0 ? (actMargin / actIncome) * 100 : null;

      const byMonth = new Map<string, { income: number; cost: number }>();
      for (const item of projectActuals) {
        if (!item.invoice_date) continue;
        const ym = (item.invoice_date as string).slice(0, 7);
        const entry = byMonth.get(ym) ?? { income: 0, cost: 0 };
        if (item.type === "income") entry.income += effSub(item);
        else entry.cost += effSub(item);
        byMonth.set(ym, entry);
      }
      const actualsTimeline: TimelinePoint[] = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, vals]) => ({ ym, income: vals.income, cost: vals.cost }));

      return {
        id: pid,
        name: project.name,
        head_client: project.head_client,
        brand: project.brand,
        estimateName: best?.name ?? null,
        estRevenue,
        estCostBase,
        estOtherCosts,
        estMargin,
        estMarginPct,
        actIncome,
        actCost,
        actAdminFee,
        actMargin,
        actMarginPct,
        actualsTimeline,
      };
    })
    .filter((r): r is ProjectReportData => r !== null);

  const mergedByMonth = new Map<string, { income: number; cost: number }>();
  for (const p of reports) {
    for (const { ym, income, cost } of p.actualsTimeline) {
      const entry = mergedByMonth.get(ym) ?? { income: 0, cost: 0 };
      entry.income += income;
      entry.cost += cost;
      mergedByMonth.set(ym, entry);
    }
  }
  const combinedTimeline: TimelinePoint[] = Array.from(mergedByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, vals]) => ({ ym, income: vals.income, cost: vals.cost }));

  return { reports, combinedTimeline };
}
