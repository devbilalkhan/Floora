import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, location, head_client, status, brand, updated_at, estimates(count)"
    )
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
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
      </div>

      {!projects || projects.length === 0 ? (
        <div className="border border-border rounded-xl flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <p className="text-base font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first project to get started.
            </p>
            <NewProjectDialog orgId={org.id} orgSlug={org.slug} />
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Project</TableHead>
                <TableHead className="text-[10px]">Location</TableHead>
                <TableHead className="text-[10px]">Client</TableHead>
                <TableHead className="text-[10px]">Brand</TableHead>
                <TableHead className="text-[10px] text-right">Estimates</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px]">Updated</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const estimateCount =
                  (p.estimates as unknown as { count: number }[])[0]?.count ??
                  0;
                return (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="text-xs">
                      <Link
                        href={`/orgs/${params.orgSlug}/projects/${p.id}`}
                        className="font-medium text-foreground/70 hover:text-primary transition-colors block"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.location || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.head_client || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground uppercase tracking-wide">
                      {p.brand === "dfo" ? "DFO" : "SPM"}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-foreground/70">
                      {estimateCount}
                    </TableCell>
                    <TableCell>
                      {p.status === "active" ? (
                        <Badge className="bg-success/15 text-success border-success/30 text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground text-xs"
                        >
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(p.updated_at)}
                    </TableCell>
                    <TableCell>
                      <ProjectRowActions
                        projectId={p.id}
                        orgSlug={params.orgSlug}
                        currentStatus={p.status as "active" | "archived"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
