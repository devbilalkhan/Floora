import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectRowActions } from "./project-row-actions";
import { ImportTakeoffDialog } from "./import-takeoff-dialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function OrgProjectsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const supabase = createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) notFound();

  const [{ data: projects }, { data: userRole }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, location, head_client, status, brand, updated_at, estimates(count)"
      )
      .eq("organization_id", org.id)
      .order("updated_at", { ascending: false }),
    supabase.rpc("user_org_role", { org_id: org.id }),
  ]);

  const canWrite = ["admin", "project_manager"].includes(userRole ?? "");

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        {canWrite && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {!projects || projects.length === 0 ? (
        <div className="border border-border rounded-xl flex items-center justify-center h-64">
          <div className="text-center space-y-3">
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
                      {p.status === "active" ? (
                        <Badge className="bg-success/15 text-success border-success/30 text-[11px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[11px]">
                          Archived
                        </Badge>
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
                          currentStatus={p.status as "active" | "archived"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
