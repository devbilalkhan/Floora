import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem, WetArea, Estimate } from "@/lib/estimate-types";
import { computeSummary } from "@/lib/estimate-types";
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
    supabase.from("estimates").select("*").eq("id", params.estimateId).single(),
    supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", params.estimateId)
      .eq("type", "primary")
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name, head_client, location")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("estimate_wet_areas")
      .select("*")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase
      .from("organizations")
      .select("id, name, logo_url, abn, address, phone, org_email, quote_terms, quote_notes")
      .eq("slug", params.orgSlug)
      .single(),
  ]);

  if (!estimate || !project) notFound();

  const allItems = (rawItems ?? []) as EstimateItem[];
  const wetAreas = (rawWetAreas ?? []) as WetArea[];

  // We need all items (including consumables) for the summary calculation
  const { data: allRawItems } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", params.estimateId)
    .order("sort_order");

  const summary = computeSummary(
    (allRawItems ?? []) as EstimateItem[],
    estimate as Estimate,
    wetAreas
  );

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const quoteNumber = `Q-${params.estimateId.slice(0, 8).toUpperCase()}`;

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
      primaryItems={allItems}
      summary={summary}
      quoteNumber={quoteNumber}
      today={today}
    />
  );
}
