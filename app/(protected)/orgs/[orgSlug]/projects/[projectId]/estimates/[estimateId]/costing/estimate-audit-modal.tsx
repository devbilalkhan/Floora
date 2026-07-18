"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstimateItem } from "@/lib/estimate-types";
import { auditVinylPlanks, auditItemTotalsInternal, type AuditFinding, type AuditLevel } from "@/lib/estimate-audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LEVEL_ICON: Record<AuditLevel, React.ReactNode> = {
  pass: <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />,
  fail: <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />,
  info: <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
};

const SCOPE_LABEL: Record<string, string> = {
  vinyl: "Vinyl",
  wall_vinyl: "Wall Vinyl",
};

function FindingRow({ f }: { f: AuditFinding }) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
      <div className="mt-0.5">{LEVEL_ICON[f.level]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-foreground/85">{f.itemLabel}</span>
          <span className="text-[11px] text-muted-foreground">— {f.check}</span>
        </div>
        {f.level !== "pass" && f.level !== "info" && (
          <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
            expected <span className="text-foreground/70">{f.expected}</span> · got{" "}
            <span className={cn(f.level === "fail" ? "text-destructive" : "text-warning")}>{f.actual}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function EstimateAuditModal({
  items,
  catTotals,
}: {
  items: EstimateItem[];
  catTotals: Record<string, { mat: number; lab: number; total: number }>;
}) {
  const [open, setOpen] = useState(false);

  // Vinyl-plank audit only for now — sheet vinyl, wall vinyl, carpet, etc. follow next.
  const reports = useMemo(() => {
    if (!open) return [];
    return (["vinyl", "wall_vinyl"] as const)
      .filter((scope) => items.some((i) => i.scope_category === scope && i.type === "primary" && !i.parent_item_id))
      .map((scope) => {
        const report = auditVinylPlanks(items, scope, catTotals[scope]);
        const internal = auditItemTotalsInternal(items, scope);
        return { ...report, findings: [...report.findings, ...internal] };
      });
  }, [open, items, catTotals]);

  const totalFail = reports.reduce((s, r) => s + r.findings.filter((f) => f.level === "fail").length, 0);
  const totalWarn = reports.reduce((s, r) => s + r.findings.filter((f) => f.level === "warn").length, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary border border-primary/30 rounded px-2 py-0.5 transition-colors"
      >
        <ClipboardCheck className="h-2.5 w-2.5" />
        Verify
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              Estimate Audit — Vinyl Plank
              {reports.length > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                    totalFail > 0
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : totalWarn > 0
                      ? "bg-warning/10 text-warning border-warning/30"
                      : "bg-success/10 text-success border-success/30"
                  )}
                >
                  {totalFail > 0 ? `${totalFail} issue${totalFail !== 1 ? "s" : ""}` : totalWarn > 0 ? `${totalWarn} warning${totalWarn !== 1 ? "s" : ""}` : "all clear"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription className="text-[11px] text-muted-foreground/70 -mt-2">
            Recomputes vinyl-plank quantities and costs from scratch (separate from the page&apos;s own calc
            functions) and cross-checks the result — read-only, nothing here is written back.
          </DialogDescription>

          <div className="space-y-4 py-1">
            {reports.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No vinyl or wall vinyl items in this estimate yet.
              </div>
            )}
            {reports.map((r) => (
              <div key={r.scope} className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                  <span>{SCOPE_LABEL[r.scope] ?? r.scope}</span>
                  <span className="font-mono normal-case tracking-normal text-muted-foreground/70">
                    independent total ${r.independentTotals.total.toFixed(2)}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {r.findings.map((f, idx) => (
                    <FindingRow key={idx} f={f} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
