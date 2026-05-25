import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectRowActions } from "./project-row-actions";
import { ImportTakeoffDialog } from "./import-takeoff-dialog";
import { ProjectsSearch } from "./projects-search";

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function OrgProjectsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams: { q?: string; page?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) notFound();

  const basePath = `/orgs/${params.orgSlug}/projects`;

  let dataQuery = supabase
    .from("projects")
    .select("id, name, location, head_client, status, brand, updated_at, estimates(count)")
    .eq("organization_id", org.id);

  let countQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  if (q) {
    const filter = `name.ilike.%${q}%,location.ilike.%${q}%,head_client.ilike.%${q}%`;
    dataQuery = dataQuery.or(filter);
    countQuery = countQuery.or(filter);
  }

  const [{ data: projects }, { count: totalCount }, { data: userRole }] = await Promise.all([
    dataQuery.order("updated_at", { ascending: false }).range(from, to),
    countQuery,
    supabase.rpc("user_org_role", { org_id: org.id }),
  ]);

  const total = totalCount ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const canWrite = ["admin", "project_manager"].includes(userRole ?? "");

  function pageLink(p: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (p > 1) qs.set("page", String(p));
    const str = qs.toString();
    return str ? `${basePath}?${str}` : basePath;
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold shrink-0">Projects</h1>
        <div className="flex-1" />
        <ProjectsSearch initialValue={q} basePath={basePath} />
        {canWrite && (
          <>
            <ImportTakeoffDialog
              orgId={org.id}
              orgSlug={org.slug}
              trigger={
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Import BoQ
                </Button>
              }
            />
            <NewProjectDialog orgId={org.id} orgSlug={org.slug} />
          </>
        )}
      </div>

      {!projects || projects.length === 0 ? (
        <div className="border border-border rounded-xl flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            {q ? (
              <>
                <p className="text-base font-medium">No projects match &ldquo;{q}&rdquo;</p>
                <Link
                  href={basePath}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear search
                </Link>
              </>
            ) : (
              <>
                <p className="text-base font-medium">No projects yet</p>
                {canWrite ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Create your first project to get started.
                    </p>
                    <NewProjectDialog orgId={org.id} orgSlug={org.slug} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Projects will appear here once they&apos;re created.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Project</th>
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Brand</th>
                <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Estimates</th>
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Updated</th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const estimateCount =
                  (p.estimates as unknown as { count: number }[])[0]?.count ?? 0;
                return (
                  <tr key={p.id} className="border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors group">
                    <td className="px-2 py-1.5 text-[11px]">
                      <Link
                        href={`/orgs/${params.orgSlug}/projects/${p.id}`}
                        className="font-medium text-foreground/70 hover:text-primary transition-colors block"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {p.location || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {p.head_client || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
                      {p.brand === "dfo" ? "DFO" : "SPM"}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-foreground/70">
                      {estimateCount}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.status === "active" && (
                        <Badge className="bg-success/15 text-success border-success/30 text-[11px]">Active</Badge>
                      )}
                      {p.status === "completed" && (
                        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[11px]">Completed</Badge>
                      )}
                      {p.status === "rejected" && (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px]">Rejected</Badge>
                      )}
                      {p.status === "archived" && (
                        <Badge variant="outline" className="text-muted-foreground text-[11px]">Archived</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {formatDate(p.updated_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      {canWrite && (
                        <ProjectRowActions
                          projectId={p.id}
                          projectName={p.name}
                          orgSlug={params.orgSlug}
                          currentStatus={p.status as "active" | "archived" | "completed" | "rejected"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer: count + pagination */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-black/10 dark:border-white/10 bg-card/65">
            <span className="text-[11px] text-muted-foreground">
              {total} project{total !== 1 ? "s" : ""}
              {q && <span className="ml-1 opacity-60">matching &ldquo;{q}&rdquo;</span>}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link href={pageLink(page - 1)} className="hover:text-foreground transition-colors">
                      ← Prev
                    </Link>
                  ) : (
                    <span className="opacity-30">← Prev</span>
                  )}
                  {page < totalPages ? (
                    <Link href={pageLink(page + 1)} className="hover:text-foreground transition-colors">
                      Next →
                    </Link>
                  ) : (
                    <span className="opacity-30">Next →</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
