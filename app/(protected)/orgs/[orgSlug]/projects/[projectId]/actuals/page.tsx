import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeSummary } from "@/lib/estimate-types";
import type { EstimateItem, EstimateSettings, WetArea } from "@/lib/estimate-types";
import type { EstimateComparison } from "@/lib/actuals-excel-export";
import { ActualsPageClient } from "./actuals-page-client";
import { ActualsExportButton } from "./actuals-export-button";
import { SupplierSummaryButton } from "./supplier-summary-drawer";

export default async function ActualsPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: userRole }, { data: groups }, { data: lineItems }, { data: org }, { data: rawEstimates }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, organization_id, retention_pct, retention_released, admin_fee_pct, admin_fee_estimated_cost")
        .eq("id", params.projectId)
        .single(),
      supabase.rpc("user_project_role", { proj_id: params.projectId }),
      supabase
        .from("actual_groups")
        .select("id, type, name, sort_order, is_collapsed, notes")
        .eq("project_id", params.projectId)
        .order("sort_order"),
      supabase
        .from("actual_line_items")
        .select("id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, source, retention_applied, included_in_totals, code")
        .eq("project_id", params.projectId)
        .order("sort_order"),
      supabase
        .from("organizations")
        .select("name")
        .eq("slug", params.orgSlug)
        .single(),
      supabase
        .from("estimates")
        .select("id, name, status, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag, grind_area, grind_labor_rate, grind_charge_rate")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: false }),
    ]);

  if (!project) notFound();
  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const allGroups = groups ?? [];
  const allLineItems = lineItems ?? [];

  // Pick approved → submitted → latest estimate for the "vs Estimate" export
  // comparison, matching the picking logic used by the project overview's
  // summary chart.
  const estimates = rawEstimates ?? [];
  const chartEstimate =
    estimates.find((e) => e.status === "approved") ??
    estimates.find((e) => e.status === "submitted") ??
    estimates[0] ??
    null;

  let estimateComparison: EstimateComparison | null = null;
  if (chartEstimate) {
    const [{ data: estItems }, { data: estWetAreas }] = await Promise.all([
      supabase
        .from("estimate_items")
        .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type")
        .eq("estimate_id", chartEstimate.id),
      supabase
        .from("estimate_wet_areas")
        .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
        .eq("estimate_id", chartEstimate.id),
    ]);
    const settings: EstimateSettings = {
      accounting_rate: chartEstimate.accounting_rate ?? 0,
      admin_rate: chartEstimate.admin_rate ?? 0,
      net_markup_pct: chartEstimate.net_markup_pct ?? 0,
      freight: chartEstimate.freight ?? 0,
      accommodation: chartEstimate.accommodation ?? 0,
      travel_allowance: chartEstimate.travel_allowance ?? 0,
      bailing_fee: chartEstimate.bailing_fee ?? 0,
      floor_prep_area: chartEstimate.floor_prep_area ?? 0,
      floor_prep_depth_mm: chartEstimate.floor_prep_depth_mm ?? 3,
      floor_prep_charge_per_bag: chartEstimate.floor_prep_charge_per_bag ?? 0,
      floor_prep_mat_per_bag: chartEstimate.floor_prep_mat_per_bag ?? 33,
      floor_prep_lab_per_bag: chartEstimate.floor_prep_lab_per_bag ?? 40,
      grind_area: chartEstimate.grind_area ?? 0,
      grind_labor_rate: chartEstimate.grind_labor_rate ?? 0,
      grind_charge_rate: chartEstimate.grind_charge_rate ?? 0,
    };
    const summary = computeSummary(
      (estItems ?? []) as EstimateItem[],
      settings,
      (estWetAreas ?? []) as WetArea[]
    );
    estimateComparison = {
      estimateName: chartEstimate.name,
      totalExGst: summary.totalExGst,
      grossMarginPct: summary.grossMarginPct,
    };
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={`/orgs/${params.orgSlug}/projects`}
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Actuals</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{project.name} — Actuals</h1>
        <div className="flex items-center gap-2">
          <ActualsExportButton
            orgName={org?.name ?? params.orgSlug}
            projectName={project.name}
            incomeGroups={allGroups.filter(g => g.type === "income")}
            expenseGroups={allGroups.filter(g => g.type === "expense")}
            allLineItems={allLineItems}
            adminFeePct={project.admin_fee_pct ?? null}
            adminFeeEstimatedCost={project.admin_fee_estimated_cost ?? null}
            retentionPct={project.retention_pct ?? null}
            retentionReleased={project.retention_released ?? 0}
            estimateComparison={estimateComparison}
          />
          <SupplierSummaryButton
            expenseGroups={allGroups.filter(g => g.type === "expense")}
            allLineItems={allLineItems}
          />
          <Link
            href={`/print/orgs/${params.orgSlug}/projects/${params.projectId}/actuals/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Report
          </Link>
        </div>
      </div>

      <ActualsPageClient
        projectId={params.projectId}
        orgId={project.organization_id}
        incomeGroups={allGroups.filter(g => g.type === "income")}
        expenseGroups={allGroups.filter(g => g.type === "expense")}
        allLineItems={allLineItems}
        retentionPct={project.retention_pct ?? null}
        initialAdminFeePct={project.admin_fee_pct ?? null}
        initialAdminFeeEstimatedCost={project.admin_fee_estimated_cost ?? null}
      />
    </div>
  );
}
