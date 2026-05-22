import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, FileText, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { QuoteActions } from "./quote-actions";

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-gray-100 text-gray-600",
  sent:     "bg-blue-50 text-blue-600",
  accepted: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-600",
};

export default async function QuotesListPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", {
    proj_id: params.projectId,
  });
  if (!userRole) redirect(`/orgs/${params.orgSlug}/projects`);

  const [{ data: project }, { data: quotes }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", params.projectId).single(),
    supabase
      .from("quotes")
      .select("id, quote_number, quote_date, to_name, project_ref, total_ex_gst, grand_total, status, estimate_id, created_at")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const fmt = (n: number) =>
    n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
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
        <span className="text-foreground">Quotes</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Quotes</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}/submission-pack`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Package className="h-3.5 w-3.5" />
            Submission Pack
          </Link>
          <Link
            href={`/orgs/${params.orgSlug}/projects/${params.projectId}`}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New quote from estimate
          </Link>
        </div>
      </div>

      {(!quotes || quotes.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground/70">No quotes yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Open an estimate and click <strong>Quote</strong> to create one.
          </p>
        </div>
      ) : (
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                {["Quote No.", "Date", "Client", "Project Ref", "Total ex GST", "Total incl. GST", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="group border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2">
                    <Link
                      href={`/orgs/${params.orgSlug}/projects/${params.projectId}/quotes/${q.id}`}
                      className="text-[11px] font-mono text-primary hover:underline"
                    >
                      {q.quote_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-foreground/70">{q.quote_date}</td>
                  <td className="px-3 py-2 text-[11px] text-foreground/70">{q.to_name || "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-foreground/70">{q.project_ref || "—"}</td>
                  <td className="px-3 py-2 text-[11px] tabular-nums text-foreground/70">${fmt(q.total_ex_gst ?? 0)}</td>
                  <td className="px-3 py-2 text-[11px] tabular-nums font-medium text-foreground/80">${fmt(q.grand_total ?? 0)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_STYLES[q.status] ?? STATUS_STYLES.draft}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <QuoteActions
                      quoteId={q.id}
                      orgSlug={params.orgSlug}
                      projectId={params.projectId}
                      currentStatus={q.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
