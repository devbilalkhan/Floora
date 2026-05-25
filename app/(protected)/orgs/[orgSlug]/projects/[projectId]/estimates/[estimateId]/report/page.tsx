import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem, WetArea, Estimate } from "@/lib/estimate-types";
import { ReportDocument } from "@/components/report/report-document";
import { ReportControls } from "./report-controls";
import { LEVELS } from "@/lib/takeoff-types";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
  searchParams: { mode?: string; level?: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", {
    proj_id: params.projectId,
  });
  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [
    { data: estimate },
    { data: rawItems },
    { data: project },
    { data: rawWetAreas },
    { data: org },
  ] = await Promise.all([
    supabase.from("estimates").select("id, project_id, name, description, status, source_takeoff_id, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag").eq("id", params.estimateId).single(),
    supabase
      .from("estimate_items")
      .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase.from("projects").select("id, name").eq("id", params.projectId).single(),
    supabase
      .from("estimate_wet_areas")
      .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase.from("organizations").select("name, logo_url").eq("slug", params.orgSlug).single(),
  ]);

  if (!estimate || !project) notFound();

  const allItems = (rawItems ?? []) as EstimateItem[];
  const wetAreas = (rawWetAreas ?? []) as WetArea[];
  const mode = searchParams.mode === "detailed" ? "detailed" : "summary";

  // Derive distinct levels present in primary items (in canonical order)
  const levelSet = new Set(allItems.filter(i => !i.parent_item_id && i.level).map(i => i.level as string));
  const levels = LEVELS.filter(l => levelSet.has(l));
  const level = levels.length > 1 && searchParams.level && searchParams.level !== "all"
    ? searchParams.level
    : "all";

  const items: EstimateItem[] = level === "all"
    ? allItems
    : (() => {
        const visibleIds = new Set(allItems.filter(i => !i.parent_item_id && i.level === level).map(i => i.id));
        return allItems.filter(i => i.parent_item_id ? visibleIds.has(i.parent_item_id) : i.level === level);
      })();

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 14mm 16mm; } }`}</style>
      <div className="max-w-[67rem] mx-auto py-6 px-4 space-y-5 print:py-0 print:px-0 print:max-w-none print:space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}`} className="hover:text-foreground transition-colors">
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/costing`}
          className="hover:text-foreground transition-colors"
        >
          {estimate.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">P&amp;L Report</span>
      </nav>

      <ReportDocument
        orgName={org?.name ?? params.orgSlug}
        orgLogoUrl={org?.logo_url ?? null}
        projectName={project.name}
        estimate={estimate as Estimate}
        items={items}
        wetAreas={wetAreas}
        mode={mode}
        level={level}
        today={today}
        controls={
          <ReportControls
            orgSlug={params.orgSlug}
            projectId={params.projectId}
            estimateId={params.estimateId}
            mode={mode}
            levels={levels}
            level={level}
          />
        }
      />
      </div>
    </>
  );
}
