"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EstimateRowActions } from "./estimate-row-actions";
import type { Summary } from "@/lib/estimate-types";

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10",
  submitted: "bg-primary/15 text-primary border-primary/30",
  approved:  "bg-success/15 text-success border-success/30",
  rejected:  "bg-destructive/15 text-destructive border-destructive/30",
};

function gpBadgeStyle(pct: number, hasItems: boolean): string {
  if (!hasItems) return "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10";
  if (pct >= 0.25) return "bg-success/15 text-success border-success/30";
  if (pct >= 0.15) return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EstimateTableRow({
  estimate,
  orgSlug,
  projectId,
  summary,
  canManageEstimates,
}: {
  estimate: { id: string; name: string; status: string; updated_at: string };
  orgSlug: string;
  projectId: string;
  summary: Summary;
  canManageEstimates: boolean;
}) {
  const router = useRouter();
  const href = `/orgs/${orgSlug}/projects/${projectId}/estimates/${estimate.id}/costing`;
  const hasItems = summary.base > 0;

  return (
    <tr
      className={`group border-b border-black/10 dark:border-white/10 hover:bg-muted/10 transition-colors last:border-0 ${canManageEstimates ? "cursor-pointer" : "cursor-default"}`}
      onClick={canManageEstimates ? () => router.push(href) : undefined}
    >
      <td className="px-3 py-1.5 text-[11px] font-medium text-foreground/70 group-hover:text-primary transition-colors">
        {estimate.name}
      </td>
      <td className="px-2 py-1.5">
        <Badge className={`text-[10px] capitalize ${STATUS_STYLES[estimate.status] ?? ""}`}>
          {estimate.status}
        </Badge>
      </td>
      <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
        {formatDate(estimate.updated_at)}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-foreground/70">
        {hasItems ? `$${fmt(summary.totalExGst)}` : "—"}
      </td>
      <td className="px-2 py-1.5 text-center">
        <Badge className={`text-[10px] ${gpBadgeStyle(summary.grossMarginPct, hasItems)}`}>
          {hasItems ? `${(summary.grossMarginPct * 100).toFixed(1)}%` : "—"}
        </Badge>
      </td>
      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-foreground/70">
        {hasItems ? `$${fmt(summary.markupAmount)}` : "—"}
      </td>
      <td
        className="px-2 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <EstimateRowActions
            estimateId={estimate.id}
            projectId={projectId}
            orgSlug={orgSlug}
            canManageEstimates={canManageEstimates}
          />
        </div>
      </td>
    </tr>
  );
}
