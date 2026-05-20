import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem, WetArea, Estimate } from "@/lib/estimate-types";
import { ReportDocument } from "@/components/report/report-document";
import { ReportControls } from "./report-controls";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
  searchParams: { mode?: string };
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
      .order("sort_order"),
    supabase.from("projects").select("id, name").eq("id", params.projectId).single(),
    supabase
      .from("estimate_wet_areas")
      .select("*")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase.from("organizations").select("name").eq("slug", params.orgSlug).single(),
  ]);

  if (!estimate || !project) notFound();

  const items = (rawItems ?? []) as EstimateItem[];
  const wetAreas = (rawWetAreas ?? []) as WetArea[];
  const mode = searchParams.mode === "detailed" ? "detailed" : "summary";

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-[67rem] mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
        projectName={project.name}
        estimate={estimate as Estimate}
        items={items}
        wetAreas={wetAreas}
        mode={mode}
        today={today}
        controls={
          <ReportControls
            orgSlug={params.orgSlug}
            projectId={params.projectId}
            estimateId={params.estimateId}
            mode={mode}
          />
        }
      />
    </div>
  );
}
