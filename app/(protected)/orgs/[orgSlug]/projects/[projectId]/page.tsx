import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, FileText, Image, Mail, ClipboardList } from "lucide-react";
import { NewEstimateDialog } from "./new-estimate-dialog";
import { EstimateTableRow } from "./estimate-table-row";
import { TakeoffListTable } from "./takeoff-list-table";
import { ProjectNameHeader } from "./project-name-header";
import { DeleteProjectZone } from "./delete-project-zone";
import { computeSummary } from "@/lib/estimate-types";
import type { EstimateItem, EstimateSettings } from "@/lib/estimate-types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  floor_plan: "Floor Plan",
  elevation: "Elevation",
  detail: "Detail",
  other: "Other",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: rawEstimates }, { data: drawings }, { data: rawTakeoffs }, { data: rawPriceRequests }, { data: userRole }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, brand, status, location, head_client, notes")
        .eq("id", params.projectId)
        .single(),
      supabase
        .from("estimates")
        .select("id, name, status, updated_at, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("drawings")
        .select("id, name, type, mime_type, page_count, created_at")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("takeoffs")
        .select("id, name, created_at, project_takeoff(count)")
        .eq("project_id", params.projectId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("price_requests")
        .select("id, status")
        .eq("project_id", params.projectId),
      supabase.rpc("user_project_role", { proj_id: params.projectId }),
    ]);

  const isViewer = userRole === "viewer";
  const canManageEstimates = ["admin", "project_manager"].includes(userRole ?? "");
  const canWrite = userRole !== null && !isViewer;

  const estimates = rawEstimates ?? [];

  // Fetch all estimate items for this project in one query, then compute summaries
  const estimateIds = estimates.map((e) => e.id);
  const { data: allItems } = estimateIds.length
    ? await supabase
        .from("estimate_items")
        .select("*")
        .in("estimate_id", estimateIds)
    : { data: [] };

  const itemsByEstimate = new Map<string, EstimateItem[]>();
  for (const item of allItems ?? []) {
    const list = itemsByEstimate.get(item.estimate_id) ?? [];
    list.push(item as EstimateItem);
    itemsByEstimate.set(item.estimate_id, list);
  }

  const estimateSummaries = new Map(
    estimates.map((e) => {
      const settings: EstimateSettings = {
        accounting_rate: e.accounting_rate ?? 0,
        admin_rate: e.admin_rate ?? 0,
        net_markup_pct: e.net_markup_pct ?? 0,
        freight: e.freight ?? 0,
        accommodation: e.accommodation ?? 0,
        travel_allowance: e.travel_allowance ?? 0,
        bailing_fee: e.bailing_fee ?? 0,
        floor_prep_area: e.floor_prep_area ?? 0,
        floor_prep_depth_mm: e.floor_prep_depth_mm ?? 3,
        floor_prep_charge_per_bag: e.floor_prep_charge_per_bag ?? 0,
        floor_prep_mat_per_bag: e.floor_prep_mat_per_bag ?? 33,
        floor_prep_lab_per_bag: e.floor_prep_lab_per_bag ?? 40,
      };
      return [e.id, computeSummary(itemsByEstimate.get(e.id) ?? [], settings)];
    })
  );

  const priceRequests = rawPriceRequests ?? [];
  const pendingReplies = priceRequests.filter((r) => r.status === "sent").length;

  const takeoffItems = (rawTakeoffs ?? []).map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    created_at: t.created_at as string,
    row_count: Number(t.project_takeoff?.[0]?.count ?? 0),
  }));

  if (!userRole) redirect("/orgs");
  if (!project) notFound();

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
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* Project header */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <ProjectNameHeader
                projectId={params.projectId}
                orgSlug={params.orgSlug}
                initialName={project.name}
                canWrite={canWrite}
              />
              <Badge
                className={
                  project.brand === "dfo"
                    ? "bg-tertiary/15 text-tertiary border-tertiary/30 text-xs"
                    : "bg-primary/15 text-primary border-primary/30 text-xs"
                }
              >
                {project.brand === "dfo" ? "DFO" : "SPM"}
              </Badge>
              {project.status === "archived" && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground text-xs"
                >
                  Archived
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {project.location && <span>{project.location}</span>}
              {project.location && project.head_client && (
                <span className="text-border">·</span>
              )}
              {project.head_client && <span>{project.head_client}</span>}
            </div>
          </div>
        </div>
        {project.notes && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">{project.notes}</p>
          </>
        )}
      </div>

      {/* Takeoffs — read-only for viewers */}
      <div className="space-y-3">
        <TakeoffListTable
          takeoffs={takeoffItems}
          projectId={params.projectId}
          orgSlug={params.orgSlug}
          canWrite={canWrite}
        />
      </div>

      {/* Price Requests — hidden for viewers */}
      {!isViewer && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Price Requests</h2>
            {priceRequests.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {priceRequests.length} total
                {pendingReplies > 0 && (
                  <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">
                    · {pendingReplies} awaiting reply
                  </span>
                )}
              </span>
            )}
          </div>
          {canManageEstimates && (
            <Link
              href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests/new`}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Mail className="h-3.5 w-3.5" />
              New Request
            </Link>
          )}
        </div>

        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/quotes`}
          className="group flex items-center gap-3 px-4 py-3 bg-card/65 backdrop-blur-xl border border-border rounded-xl hover:border-primary/40 transition-colors"
        >
          <ClipboardList className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            Quotes
          </span>
        </Link>

        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests`}
          className="group flex items-center justify-between px-4 py-3 bg-card/65 backdrop-blur-xl border border-border rounded-xl hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {priceRequests.length === 0
                ? "No price requests yet"
                : `${priceRequests.length} price ${priceRequests.length === 1 ? "request" : "requests"}`}
            </span>
          </div>
          {pendingReplies > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
              {pendingReplies} pending
            </Badge>
          )}
        </Link>
      </div>}

      {/* Estimates — hidden for viewers */}
      {!isViewer && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Estimates</h2>
          {canManageEstimates && (
            <NewEstimateDialog
              projectId={params.projectId}
              orgSlug={params.orgSlug}
              takeoffs={takeoffItems.map((t) => ({ id: t.id, name: t.name }))}
            />
          )}
        </div>

        {estimates.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl flex items-center justify-center h-40">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">No estimates yet</p>
              {canManageEstimates ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Create an estimate to begin pricing this project.
                  </p>
                  <NewEstimateDialog
                    projectId={params.projectId}
                    orgSlug={params.orgSlug}
                    takeoffs={takeoffItems.map((t) => ({ id: t.id, name: t.name }))}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Estimates will appear here once a PM creates one.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                  <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Updated
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Value ex-GST
                  </th>
                  <th className="text-center px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    GP
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Margin
                  </th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {estimates.map((e) => (
                  <EstimateTableRow
                    key={e.id}
                    estimate={e}
                    orgSlug={params.orgSlug}
                    projectId={params.projectId}
                    summary={estimateSummaries.get(e.id)!}
                    canManageEstimates={canManageEstimates}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Danger zone — admins only */}
      {userRole === "admin" && (
        <DeleteProjectZone
          projectId={params.projectId}
          projectName={project.name}
          orgSlug={params.orgSlug}
        />
      )}

      {/* Drawings */}
      {drawings && drawings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Drawings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {drawings.map((d) => (
              <Link
                key={d.id}
                href={`/projects/${params.projectId}/drawings/${d.id}`}
                className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
              >
                <div className="h-32 bg-muted/40 flex items-center justify-center">
                  {d.mime_type === "application/pdf" ? (
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <Image className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {d.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {DRAWING_TYPE_LABELS[d.type] ?? d.type} · {d.page_count}{" "}
                      {d.page_count === 1 ? "page" : "pages"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(d.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
