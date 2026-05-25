import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActualsPageClient } from "./actuals-page-client";

export default async function ActualsPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: userRole }, { data: groups }, { data: lineItems }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, organization_id, retention_pct, admin_fee_pct, admin_fee_estimated_cost")
        .eq("id", params.projectId)
        .single(),
      supabase.rpc("user_project_role", { proj_id: params.projectId }),
      supabase
        .from("actual_groups")
        .select("id, type, name, sort_order, is_collapsed, notes")
        .eq("project_id", params.projectId)
        .order("sort_order"),
      supabase
        .from("actual_line_items")
        .select("id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, source")
        .eq("project_id", params.projectId)
        .order("sort_order"),
    ]);

  if (!project) notFound();
  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const allGroups = groups ?? [];
  const allLineItems = lineItems ?? [];

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
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Actuals</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{project.name} — Actuals</h1>
        <Link
          href={`/print/orgs/${params.orgSlug}/projects/${params.projectId}/actuals/report`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Report
        </Link>
      </div>

      <ActualsPageClient
        projectId={params.projectId}
        orgId={project.organization_id}
        incomeGroups={allGroups.filter(g => g.type === "income")}
        expenseGroups={allGroups.filter(g => g.type === "expense")}
        allLineItems={allLineItems}
        retentionPct={project.retention_pct ?? null}
        initialAdminFeePct={project.admin_fee_pct ?? null}
        initialAdminFeeEstimatedCost={project.admin_fee_estimated_cost ?? null}
      />
    </div>
  );
}
