import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchReportData } from "./actions";
import { ReportShell } from "./report-shell";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams: { ids?: string };
}) {
  const supabase = createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) notFound();

  const selectedIds = (searchParams.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Always fetch project list for the picker
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name, head_client, brand, status")
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false });

  // Pre-fetch report data for initial render (supports direct URL sharing)
  const { reports: initialReports, combinedTimeline: initialTimeline } =
    selectedIds.length > 0
      ? await fetchReportData(selectedIds)
      : { reports: [], combinedTimeline: [] };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={`/orgs/${params.orgSlug}/projects`}
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground/70">Consolidated Report</span>
      </nav>

      <h1 className="text-xl font-semibold">Consolidated Report</h1>

      <ReportShell
        projects={allProjects ?? []}
        initialReports={initialReports}
        initialTimeline={initialTimeline}
        initialIds={selectedIds}
        orgSlug={params.orgSlug}
      />
    </div>
  );
}
