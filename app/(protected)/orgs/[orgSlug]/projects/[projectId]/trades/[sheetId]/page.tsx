import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TRADE_LABELS } from "@/lib/trade-sheet-types";
import type { TradeSheetColumn, TradeSheetRow } from "@/lib/trade-sheet-types";
import { TradeSheetEditor } from "./trade-sheet-editor";

export default async function TradeSheetPage({
  params,
}: {
  params: { orgSlug: string; projectId: string; sheetId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: userRole }, { data: sheet }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", params.projectId).single(),
    supabase.rpc("user_project_role", { proj_id: params.projectId }),
    supabase
      .from("trade_sheets")
      .select("id, trade, name, columns, rows, updated_at")
      .eq("id", params.sheetId)
      .eq("project_id", params.projectId)
      .maybeSingle(),
  ]);

  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }
  if (!project || !sheet) notFound();

  return (
    <div className="w-full py-6 px-8 space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
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
        <span>{TRADE_LABELS[sheet.trade] ?? sheet.trade}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{sheet.name}</span>
      </nav>

      <TradeSheetEditor
        sheetId={sheet.id}
        projectId={params.projectId}
        orgSlug={params.orgSlug}
        initialName={sheet.name}
        initialColumns={sheet.columns as TradeSheetColumn[]}
        initialRows={sheet.rows as TradeSheetRow[]}
        initialUpdatedAt={sheet.updated_at}
      />
    </div>
  );
}
