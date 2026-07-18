"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstimateItem, EstimateSettings, WetArea, Summary } from "@/lib/estimate-types";
import { auditEstimate } from "@/lib/estimate-audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SCOPE_LABEL: Record<string, string> = {
  vinyl: "Vinyl Flooring",
  wall_vinyl: "Wall Vinyl",
  carpet: "Carpet Flooring",
  matting: "Entry Matting",
  transition: "Floor Transitions",
  coving_skirting: "Coving / Skirting",
  stairs: "Stairs",
  other: "Other",
};

export function EstimateAuditModal({
  items,
  settings,
  wetAreas,
  summary,
}: {
  items: EstimateItem[];
  settings: EstimateSettings;
  wetAreas: WetArea[];
  summary: Summary;
}) {
  const [open, setOpen] = useState(false);

  const report = useMemo(() => {
    if (!open) return null;
    return auditEstimate(items, settings, wetAreas, summary);
  }, [open, items, settings, wetAreas, summary]);

  const totalMismatches = report
    ? report.scopes.reduce((s, r) => s + r.mismatches.length, 0) + report.grandTotal.mismatches.length
    : 0;

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
              Estimate Audit
              {report && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                    totalMismatches > 0
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-success/10 text-success border-success/30"
                  )}
                >
                  {totalMismatches > 0 ? `${totalMismatches} mismatch${totalMismatches !== 1 ? "es" : ""}` : "all calculations correct"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription className="text-[11px] text-muted-foreground/70 -mt-2">
            Independently recomputes every cost, quantity formula, and the overhead/mark-up/GST chain from raw
            stored values — separate from the page&apos;s own calc functions — and diffs the result. Read-only,
            calculations only, nothing here is written back.
          </DialogDescription>

          {report && (
            <div className="space-y-3 py-1">
              {report.scopes.map((r) => (
                <div key={r.scope} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {r.mismatches.length > 0 ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {SCOPE_LABEL[r.scope] ?? r.scope}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {r.itemsChecked} item{r.itemsChecked !== 1 ? "s" : ""} · {r.consumablesChecked} consumable
                        {r.consumablesChecked !== 1 ? "s" : ""} checked
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/70">${r.independentTotal.toFixed(2)}</span>
                  </div>
                  {r.mismatches.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {r.mismatches.map((m, idx) => (
                        <div key={idx} className="px-3 py-1.5">
                          <div className="text-xs font-medium text-foreground/85">
                            {m.itemLabel} — {m.check}
                          </div>
                          <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                            expected <span className="text-foreground/70">{m.expected}</span> · got{" "}
                            <span className="text-destructive">{m.actual}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/30 flex items-center gap-2">
                  {report.grandTotal.mismatches.length > 0 ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Overhead / Mark-up / GST chain
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/70 ml-auto">
                    ${report.grandTotal.independentTotalExGst.toFixed(2)} ex-GST · ${report.grandTotal.independentGrandTotal.toFixed(2)} incl. GST
                  </span>
                </div>
                {report.grandTotal.mismatches.length > 0 && (
                  <div className="divide-y divide-border/50">
                    {report.grandTotal.mismatches.map((m, idx) => (
                      <div key={idx} className="px-3 py-1.5">
                        <div className="text-xs font-medium text-foreground/85">{m.check}</div>
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                          expected <span className="text-foreground/70">{m.expected}</span> · got{" "}
                          <span className="text-destructive">{m.actual}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
