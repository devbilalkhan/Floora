import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, FileText, Image, Mail, Package } from "lucide-react";
import { NewEstimateDialog } from "./new-estimate-dialog";
import { QuoteActions } from "./quotes/quote-actions";
import { EstimateTableRow } from "./estimate-table-row";
import { TakeoffListTable } from "./takeoff-list-table";
import { ProjectNameHeader } from "./project-name-header";
import { DeleteProjectZone } from "./delete-project-zone";
import { EditProjectDetailsDialog } from "./edit-project-details-dialog";
import { CopyProjectDetails } from "./copy-project-details";
import { ProjectSummaryChart } from "./project-summary-chart";
import { ProjectMarginChart } from "./project-margin-chart";
import { computeSummary } from "@/lib/estimate-types";
import type { EstimateItem, EstimateSettings, WetArea } from "@/lib/estimate-types";

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

  const [{ data: project }, { data: rawEstimates }, { data: drawings }, { data: rawTakeoffs }, { data: rawPriceRequests }, { data: rawQuotes }, { data: userRole }, { data: rawActualsGroups }, { data: rawActualsItems }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, brand, status, location, head_client, specifier, contact_person, notes, retention_pct")
        .eq("id", params.projectId)
        .single(),
      supabase
        .from("estimates")
        .select("id, name, status, updated_at, accounting_rate, admin_rate, net_markup_pct, freight, accommodation, travel_allowance, bailing_fee, floor_prep_area, floor_prep_depth_mm, floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag, grind_area, grind_labor_rate, grind_charge_rate")
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
      supabase
        .from("quotes")
        .select("id, quote_number, quote_date, to_name, project_ref, project_loc, total_ex_gst, grand_total, status")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: false }),
      supabase.rpc("user_project_role", { proj_id: params.projectId }),
      supabase
        .from("actual_groups")
        .select("id, type")
        .eq("project_id", params.projectId),
      supabase
        .from("actual_line_items")
        .select("group_id, invoice_date, subtotal, qty, unit_price, included_in_totals")
        .eq("project_id", params.projectId),
    ]);

  const isViewer = userRole === "viewer";
  const canManageEstimates = ["admin", "project_manager"].includes(userRole ?? "");
  const canWrite = userRole !== null && !isViewer;

  const estimates = rawEstimates ?? [];

  // Fetch all estimate items and wet areas for this project in parallel, then compute summaries
  const estimateIds = estimates.map((e) => e.id);
  const [{ data: allItems }, { data: allWetAreas }] = estimateIds.length
    ? await Promise.all([
        supabase
          .from("estimate_items")
          .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type")
          .in("estimate_id", estimateIds),
        supabase
          .from("estimate_wet_areas")
          .select("id, estimate_id, sort_order, name, floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge")
          .in("estimate_id", estimateIds),
      ])
    : [{ data: [] }, { data: [] }];

  const itemsByEstimate = new Map<string, EstimateItem[]>();
  for (const item of allItems ?? []) {
    const list = itemsByEstimate.get(item.estimate_id) ?? [];
    list.push(item as EstimateItem);
    itemsByEstimate.set(item.estimate_id, list);
  }

  const wetAreasByEstimate = new Map<string, typeof allWetAreas>();
  for (const wa of allWetAreas ?? []) {
    const list = wetAreasByEstimate.get(wa.estimate_id) ?? [];
    list.push(wa);
    wetAreasByEstimate.set(wa.estimate_id, list);
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
        grind_area: e.grind_area ?? 0,
        grind_labor_rate: e.grind_labor_rate ?? 0,
        grind_charge_rate: e.grind_charge_rate ?? 0,
      };
      return [e.id, computeSummary(itemsByEstimate.get(e.id) ?? [], settings, (wetAreasByEstimate.get(e.id) ?? []) as WetArea[])];
    })
  );

  // Merge actuals items with group type for the project summary chart
  const actualsGroupTypeMap = new Map((rawActualsGroups ?? []).map(g => [g.id, g.type as "income" | "expense"]));
  const actualsItems = (rawActualsItems ?? [])
    .filter(i => i.included_in_totals)
    .map(i => ({
      invoice_date: i.invoice_date as string | null,
      subtotal: i.subtotal as number,
      qty: i.qty as number | null,
      unit_price: i.unit_price as number | null,
      type: actualsGroupTypeMap.get(i.group_id) ?? ("expense" as "income" | "expense"),
    }));

  // Actuals GP for margin chart
  function actualsEffSub(item: { qty: number | null; unit_price: number | null; subtotal: number }) {
    return item.qty != null && item.unit_price != null ? item.qty * item.unit_price : item.subtotal;
  }
  const totalActualIncome = actualsItems.filter(i => i.type === "income").reduce((s, i) => s + actualsEffSub(i), 0);
  const totalActualCost = actualsItems.filter(i => i.type === "expense").reduce((s, i) => s + actualsEffSub(i), 0);
  const actualGp = totalActualIncome - totalActualCost;
  const actualGpPct = totalActualIncome > 0 ? (actualGp / totalActualIncome) * 100 : null;

  // Pick approved → submitted → latest estimate for the chart
  const chartEstimate =
    estimates.find(e => e.status === "approved") ??
    estimates.find(e => e.status === "submitted") ??
    estimates[0] ?? null;
  const chartSummary = chartEstimate ? estimateSummaries.get(chartEstimate.id) : null;

  const hasEstimate = chartEstimate != null && chartSummary != null;
  const hasActuals = totalActualIncome > 0 || totalActualCost > 0;

  const priceRequests = rawPriceRequests ?? [];
  const pendingReplies = priceRequests.filter((r) => r.status === "sent").length;
  const quotes = rawQuotes ?? [];

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
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
              {project.status === "completed" && (
                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">Completed</Badge>
              )}
              {project.status === "rejected" && (
                <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">Rejected</Badge>
              )}
              {project.status === "archived" && (
                <Badge variant="outline" className="text-muted-foreground text-xs">Archived</Badge>
              )}
            </div>

            {/* Primary meta — location · head client */}
            {(project.location || project.head_client) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {project.location && <span>{project.location}</span>}
                {project.location && project.head_client && <span className="text-border">·</span>}
                {project.head_client && <span>{project.head_client}</span>}
                <CopyProjectDetails
                  name={project.name}
                  location={project.location}
                  headClient={project.head_client}
                />
              </div>
            )}

            {/* Secondary meta — specifier · contact */}
            {(project.specifier || project.contact_person) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {project.specifier && (
                  <span><span className="text-muted-foreground/50">Specifier</span> {project.specifier}</span>
                )}
                {project.specifier && project.contact_person && <span className="text-border">·</span>}
                {project.contact_person && (
                  <span><span className="text-muted-foreground/50">Contact</span> {project.contact_person}</span>
                )}
              </div>
            )}
          </div>

          {canWrite && (
            <EditProjectDetailsDialog
              projectId={params.projectId}
              orgSlug={params.orgSlug}
              initialName={project.name}
              initialLocation={project.location ?? null}
              initialHeadClient={project.head_client ?? null}
              initialSpecifier={project.specifier ?? null}
              initialContactPerson={project.contact_person ?? null}
              initialNotes={project.notes ?? null}
              initialRetentionPct={project.retention_pct ?? null}
            />
          )}
        </div>
        {project.notes && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">{project.notes}</p>
          </>
        )}
      </div>

      {/* Estimates — hidden for viewers */}
      {!isViewer && (
        <div className="space-y-3">
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
            <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-32">
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
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Updated
                    </th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Value ex-GST
                    </th>
                    <th className="text-center px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      GP
                    </th>
                    <th className="text-center px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Markup %
                    </th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Markup
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
        </div>
      )}

      {/* Quotes — hidden for viewers */}
      {!isViewer && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Quotes</h2>
            <div className="flex items-center gap-2">
            <Link
              href={`/orgs/${params.orgSlug}/projects/${params.projectId}/submission-pack`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Package className="h-3 w-3 shrink-0" />
              <span>Submission Pack</span>
            </Link>
            <Link
              href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span>Price Requests</span>
              <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                pendingReplies > 0
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {priceRequests.length}
              </span>
            </Link>
            </div>
          </div>

          {quotes.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-24">
              <p className="text-sm text-muted-foreground">
                No quotes yet — save one from an estimate&apos;s costing view.
              </p>
            </div>
          ) : (
            <div className="border border-black/10 dark:border-white/10 rounded-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote #</th>
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">To</th>
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Site / Ref</th>
                    <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total ex GST</th>
                    <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Inc GST</th>
                    <th className="text-center px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr
                      key={q.id}
                      className="group border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/quotes/${q.id}`}
                          className="text-xs font-mono text-primary hover:underline"
                        >
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-xs text-foreground/70">
                        {q.to_name ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {q.project_loc || q.project_ref || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {q.quote_date ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-right tabular-nums text-foreground/70">
                        {q.total_ex_gst != null
                          ? `$${q.total_ex_gst.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-right tabular-nums text-muted-foreground">
                        {q.grand_total != null
                          ? `$${q.grand_total.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          q.status === "sent"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : q.status === "accepted"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/60 text-muted-foreground"
                        }`}>
                          {q.status ?? "draft"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <QuoteActions
                          quoteId={q.id}
                          orgSlug={params.orgSlug}
                          projectId={params.projectId}
                          currentStatus={q.status ?? "draft"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Actuals — admin/PM only */}
      {canManageEstimates && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Actuals</h2>
          {!hasEstimate && !hasActuals ? (
            <div className="rounded-xl border border-dashed border-border flex items-center justify-center h-24">
              <p className="text-sm text-muted-foreground">No estimate or actuals yet — add an estimate or record income and expenses to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProjectSummaryChart
                estimateLabel={hasEstimate ? chartEstimate!.name : undefined}
                estimateValue={hasEstimate ? chartSummary!.totalExGst : undefined}
                actualsItems={actualsItems}
                href={`/orgs/${params.orgSlug}/projects/${params.projectId}/actuals`}
              />
              <ProjectMarginChart
                estimateGpPct={hasEstimate ? chartSummary!.grossMarginPct : undefined}
                estimateGp={hasEstimate ? chartSummary!.totalExGst * chartSummary!.grossMarginPct : undefined}
                estimateValue={hasEstimate ? chartSummary!.totalExGst : undefined}
                actualGpPct={actualGpPct}
                actualGp={actualGp}
                actualIncome={totalActualIncome}
                href={`/orgs/${params.orgSlug}/projects/${params.projectId}/actuals`}
              />
            </div>
          )}
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/actuals`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3 hover:border-primary/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                Income, Expenses &amp; Margin
              </p>
              <p className="text-xs text-muted-foreground">
                Track real revenue and costs against the estimate
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </Link>
        </div>
      )}

      {/* Takeoffs */}
      <div className="space-y-3">
        <TakeoffListTable
          takeoffs={takeoffItems}
          projectId={params.projectId}
          orgSlug={params.orgSlug}
          canWrite={canWrite}
        />
      </div>

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

      {/* Danger zone — admins only */}
      {userRole === "admin" && (
        <DeleteProjectZone
          projectId={params.projectId}
          projectName={project.name}
          orgSlug={params.orgSlug}
        />
      )}
    </div>
  );
}
