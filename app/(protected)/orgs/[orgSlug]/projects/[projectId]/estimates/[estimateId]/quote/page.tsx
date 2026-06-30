import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem, WetArea, Estimate } from "@/lib/estimate-types";
import { computeSummary } from "@/lib/estimate-types";
import { LEVELS } from "@/lib/takeoff-types";
import { QuoteEditor } from "./quote-editor";

export default async function QuotePage({
  params,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
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
    supabase.from("estimates").select("id, project_id, name, description, status, source_takeoff_id, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag, grind_area, grind_labor_rate, grind_charge_rate").eq("id", params.estimateId).single(),
    supabase
      .from("estimate_items")
      .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name, head_client, location")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("estimate_wet_areas")
      .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase
      .from("organizations")
      .select("id, name, logo_url, abn, address, phone, org_email, quote_terms, quote_notes")
      .eq("slug", params.orgSlug)
      .single(),
  ]);

  // Generate a sequential quote number for new quotes
  const { data: nextNumber } = org?.id
    ? await supabase.rpc("next_quote_number", { org_id: org.id })
    : { data: null };

  if (!estimate || !project) notFound();

  const allItems = (rawItems ?? []) as EstimateItem[];
  const wetAreas = (rawWetAreas ?? []) as WetArea[];
  const primaryItems = allItems.filter((i) => i.type === "primary");

  const levelSet = new Set(primaryItems.filter((i) => i.level).map((i) => i.level as string));
  const levels = LEVELS.filter((l) => levelSet.has(l));

  const summary = computeSummary(allItems, estimate as Estimate, wetAreas);

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const quoteNumber = (nextNumber as string | null) ?? `Q-${params.estimateId.slice(0, 8).toUpperCase()}`;

  return (
    <QuoteEditor
      orgSlug={params.orgSlug}
      orgId={org?.id ?? ""}
      projectId={params.projectId}
      estimateId={params.estimateId}
      orgName={org?.name ?? params.orgSlug}
      orgLogoUrl={org?.logo_url ?? null}
      orgAbn={org?.abn ?? ""}
      orgAddress={org?.address ?? ""}
      orgPhone={org?.phone ?? ""}
      orgEmail={org?.org_email ?? ""}
      quoteTerms={org?.quote_terms ?? ""}
      quoteNotes={org?.quote_notes ?? ""}
      projectName={project.name}
      projectLocation={project.location ?? ""}
      clientName={project.head_client ?? ""}
      estimateName={estimate.name}
      primaryItems={primaryItems}
      levels={levels}
      summary={summary}
      quoteNumber={quoteNumber}
      today={today}
    />
  );
}
