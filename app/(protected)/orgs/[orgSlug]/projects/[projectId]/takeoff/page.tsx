import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, Printer, ArrowLeft, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TakeoffTable } from "./takeoff-table";
import { TakeoffSelector } from "./takeoff-selector";
import { MarkupControl } from "@/components/markup/markup-control";
import { CreateEstimateButton } from "./create-estimate-button";
import type { TakeoffRow } from "./constants";
import type { Takeoff } from "@/lib/takeoff-types";

export default async function TakeoffPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; projectId: string };
  searchParams: { takeoffId?: string; fromEstimate?: string };
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: takeoffs }, { data: fromEstimate }, { data: projectDocs }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, brand, location, head_client, organization_id")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("takeoffs")
      .select("*")
      .eq("project_id", params.projectId)
      .order("sort_order")
      .order("created_at"),
    searchParams.fromEstimate
      ? supabase
          .from("estimates")
          .select("id, name")
          .eq("id", searchParams.fromEstimate)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("project_documents")
      .select("id, name")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const allTakeoffs = (takeoffs ?? []) as Takeoff[];

  // Resolve which takeoff to show
  const selectedId =
    searchParams.takeoffId && allTakeoffs.some((t) => t.id === searchParams.takeoffId)
      ? searchParams.takeoffId
      : allTakeoffs[0]?.id ?? null;

  const selectedTakeoff = allTakeoffs.find((t) => t.id === selectedId) ?? null;

  // Fetch rows and member role in parallel
  const [{ data: rows }, { data: memberRow }] = await Promise.all([
    selectedId
      ? supabase
          .from("project_takeoff")
          .select("*")
          .eq("takeoff_id", selectedId)
          .order("scope_category")
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", user.id)
      .single(),
  ]);

  const canWrite = memberRow?.role !== "viewer";
  const canManageEstimates = ["admin", "project_manager"].includes(memberRow?.role ?? "");

  return (
    <div className="max-w-[1440px] mx-auto py-6 px-4 space-y-5">
      {/* Back to estimate banner */}
      {fromEstimate && (
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${fromEstimate.id}/costing`}
          className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to estimate: <span className="font-medium">{fromEstimate.name}</span>
        </Link>
      )}

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
        <span className="text-foreground">Takeoff</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Takeoff</h1>
            <Badge
              className={
                project.brand === "dfo"
                  ? "bg-tertiary/15 text-tertiary border-tertiary/30 text-xs"
                  : "bg-primary/15 text-primary border-primary/30 text-xs"
              }
            >
              {project.brand === "dfo" ? "DFO" : "SPM"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedTakeoff?.name ?? "—"}
            <span className="text-muted-foreground/60"> · {project.name}</span>
          </p>
          <p className="text-xs text-muted-foreground/60">
            Changes save automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MarkupControl
            projectId={params.projectId}
            orgSlug={params.orgSlug}
            initialDocs={projectDocs ?? []}
          />
          {canWrite && (
            <Link
              href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted/40 transition-colors shrink-0"
            >
              <Mail className="h-3.5 w-3.5" />
              Price Requests
            </Link>
          )}
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/takeoff/print`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted/40 transition-colors shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Link>
          {selectedTakeoff && canManageEstimates && (
            <CreateEstimateButton
              projectId={params.projectId}
              orgSlug={params.orgSlug}
              takeoffId={selectedTakeoff.id}
              takeoffName={selectedTakeoff.name}
            />
          )}
        </div>
      </div>

      {/* Takeoff selector */}
      <TakeoffSelector
        takeoffs={allTakeoffs}
        selectedId={selectedId ?? ""}
        projectId={params.projectId}
        orgSlug={params.orgSlug}
        canWrite={canWrite}
      />

      {/* Empty state — no takeoffs yet */}
      {allTakeoffs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-base font-medium">No takeoffs yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create a new takeoff or import one from a spreadsheet to get started.
          </p>
        </div>
      )}

      {/* Table */}
      {selectedId && (
        <TakeoffTable
          key={selectedId}
          takeoffId={selectedId}
          initialRows={(rows ?? []) as TakeoffRow[]}
          canWrite={canWrite}
        />
      )}

    </div>
  );
}
