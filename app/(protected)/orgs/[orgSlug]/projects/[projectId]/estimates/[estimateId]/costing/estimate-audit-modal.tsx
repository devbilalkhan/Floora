"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ClipboardCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstimateItem, EstimateSettings, WetArea, Summary } from "@/lib/estimate-types";
import { auditEstimate, type AuditCheck } from "@/lib/estimate-audit";
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

function CheckRow({ c }: { c: AuditCheck }) {
  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {c.pass ? (
          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-destructive shrink-0" />
        )}
        <span className="text-xs font-medium text-foreground/85">
          {c.itemLabel} — {c.check}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono pl-[18px]">{c.working}</div>
      {!c.pass && (
        <div className="text-[10px] mt-0.5 font-mono pl-[18px]">
          <span className="text-muted-foreground/70">page shows</span> <span className="text-destructive">{c.actual}</span>
        </div>
      )}
    </div>
  );
}

function SectionGroup({
  icon,
  title,
  meta,
  total,
  checks,
  defaultOpen,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  total: string;
  checks: AuditCheck[];
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border border-border rounded-lg overflow-hidden" open={defaultOpen}>
      <summary className="px-3 py-1.5 bg-muted/30 flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        {meta && <span className="text-[10px] text-muted-foreground/60">{meta}</span>}
        <span className="text-[10px] font-mono text-muted-foreground/70 ml-auto">{total}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="divide-y divide-border/50">
        {checks.map((c, idx) => (
          <CheckRow key={idx} c={c} />
        ))}
      </div>
    </details>
  );
}

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
    ? report.scopes.reduce((s, r) => s + r.checks.filter((c) => !c.pass).length, 0) +
      report.grandTotal.checks.filter((c) => !c.pass).length
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
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
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
            stored values — separate from the page&apos;s own calc functions — and diffs the result. Click a
            section to see the full workings. Read-only, nothing here is written back.
          </DialogDescription>

          {report && (
            <div className="space-y-3 py-1">
              {report.scopes.map((r) => {
                const hasMismatch = r.checks.some((c) => !c.pass);
                return (
                  <SectionGroup
                    key={r.scope}
                    icon={
                      hasMismatch ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      )
                    }
                    title={SCOPE_LABEL[r.scope] ?? r.scope}
                    meta={`${r.itemsChecked} item${r.itemsChecked !== 1 ? "s" : ""} · ${r.consumablesChecked} consumable${r.consumablesChecked !== 1 ? "s" : ""}`}
                    total={`$${r.independentTotal.toFixed(2)}`}
                    checks={r.checks}
                    defaultOpen={hasMismatch}
                  />
                );
              })}

              <SectionGroup
                icon={
                  report.grandTotal.checks.some((c) => !c.pass) ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  )
                }
                title="Overhead / Mark-up / GST chain"
                total={`$${report.grandTotal.independentTotalExGst.toFixed(2)} ex-GST · $${report.grandTotal.independentGrandTotal.toFixed(2)} incl. GST`}
                checks={report.grandTotal.checks}
                defaultOpen={report.grandTotal.checks.some((c) => !c.pass)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
