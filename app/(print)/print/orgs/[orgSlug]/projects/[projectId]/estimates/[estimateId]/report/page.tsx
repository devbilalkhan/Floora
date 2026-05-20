import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem, WetArea, Estimate } from "@/lib/estimate-types";
import { ReportDocument } from "@/components/report/report-document";
import { PrintToolbar } from "@/components/report/print-toolbar";

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
  searchParams: { mode?: string };
}) {
  const supabase = createClient();

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
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 16mm; }
          body { background: white !important; }
        }
      `}</style>

      <PrintToolbar estimateName={estimate.name} />

      {/* PDF viewer: dark surround on screen, white page when printing */}
      <div className="min-h-screen bg-zinc-900 pt-14 pb-16 print:bg-white print:pt-0 print:pb-0">
        <div className="max-w-[67rem] mx-auto py-6 px-4 print:py-0 print:px-0 print:max-w-none">
          <ReportDocument
            orgName={org?.name ?? params.orgSlug}
            projectName={project.name}
            estimate={estimate as Estimate}
            items={items}
            wetAreas={wetAreas}
            mode={mode}
            today={today}
          />
        </div>
      </div>
    </>
  );
}
