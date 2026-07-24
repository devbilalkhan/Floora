import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShoppingCart, ArrowLeft, ShieldCheck, BarChart2, FileText } from "lucide-react";
import { PriceListLinks } from "./price-list-sheet";
import { createClient } from "@/lib/supabase/server";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";
import { CostingTable } from "./costing-table";
import { EstimateSwitcher } from "./estimate-switcher";
import { EstimateStatusBadge } from "./estimate-status-badge";
import { EstimateAttachmentsPanel } from "./estimate-attachments-panel";
import { EstimateNotesPanel } from "./estimate-notes-panel";
import type { EstimateAttachment } from "./actions";

export default async function CostingPage({
  params,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [
    { data: estimate },
    { data: rawItems },
    { data: project },
    { data: takeoffs },
    { data: rawWetAreas },
    { data: allEstimates },
    { data: rawPriceRequests },
    { data: rawAttachments },
    { data: org },
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, project_id, name, description, status, source_takeoff_id, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag, grind_area, grind_labor_rate, grind_charge_rate")
      .eq("id", params.estimateId)
      .single(),
    supabase
      .from("estimate_items")
      .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, qty_manually_set, manufacturer, level, product_type")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("takeoffs")
      .select("id, name")
      .eq("project_id", params.projectId)
      .order("sort_order"),
    supabase
      .from("estimate_wet_areas")
      .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase
      .from("estimates")
      .select("id, name")
      .eq("project_id", params.projectId)
      .order("created_at"),
    supabase
      .from("price_requests")
      .select("products")
      .eq("project_id", params.projectId)
      .eq("status", "received"),
    supabase
      .from("estimate_attachments")
      .select("id, name, mime_type, size_bytes, created_at")
      .eq("estimate_id", params.estimateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("name")
      .eq("slug", params.orgSlug)
      .single(),
  ]);

  if (!estimate || !project) notFound();

  const confirmedPrices: Record<string, number> = {};
  for (const req of rawPriceRequests ?? []) {
    const products = Array.isArray(req.products)
      ? (req.products as Array<{ finish_code?: string; confirmed_price?: number | null }>)
      : [];
    for (const p of products) {
      if (p.finish_code && p.confirmed_price != null && p.confirmed_price > 0) {
        confirmedPrices[p.finish_code] = p.confirmed_price;
      }
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto py-6 px-4 space-y-4">
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
        <span className="text-foreground">{estimate.name}</span>
      </nav>

      {/* Back to takeoff link */}
      <Link
        href={
          estimate.source_takeoff_id
            ? `/orgs/${params.orgSlug}/projects/${params.projectId}/takeoff?takeoffId=${estimate.source_takeoff_id}&fromEstimate=${params.estimateId}`
            : `/orgs/${params.orgSlug}/projects/${params.projectId}/takeoff?fromEstimate=${params.estimateId}`
        }
        className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Takeoffs
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{estimate.name}</h1>
        <EstimateStatusBadge estimateId={params.estimateId} initialStatus={estimate.status} />
        <EstimateSwitcher
          estimates={(allEstimates ?? []) as { id: string; name: string }[]}
          currentId={params.estimateId}
          orgSlug={params.orgSlug}
          projectId={params.projectId}
        />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/quote`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Quote
          </Link>
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/report`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            P&amp;L Report
          </Link>
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/swms`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            SWMS
          </Link>
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/materials`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Material Schedule
          </Link>
        </div>
      </div>

      {/* Price list quick links */}
      <PriceListLinks />

      <CostingTable
        estimate={estimate as Estimate}
        initialItems={(rawItems ?? []) as EstimateItem[]}
        initialWetAreas={(rawWetAreas ?? []) as WetArea[]}
        takeoffs={(takeoffs ?? []) as { id: string; name: string }[]}
        orgSlug={params.orgSlug}
        projectId={params.projectId}
        confirmedPrices={confirmedPrices}
        orgName={org?.name ?? params.orgSlug}
        projectName={project.name}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EstimateNotesPanel
          estimateId={params.estimateId}
          initialNotes={estimate.description}
        />
        <EstimateAttachmentsPanel
          estimateId={params.estimateId}
          projectId={params.projectId}
          initialAttachments={(rawAttachments ?? []) as EstimateAttachment[]}
        />
      </div>
    </div>
  );
}
