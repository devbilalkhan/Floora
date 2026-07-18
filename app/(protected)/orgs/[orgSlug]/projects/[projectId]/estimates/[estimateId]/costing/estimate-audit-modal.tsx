"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, ClipboardCheck, ChevronDown, Loader2 } from "lucide-react";
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

const STEP_DELAY_MS = 900;

type Step = {
  key: string;
  hasMismatch: boolean;
  title: string;
  meta?: string;
  total: string;
  checks: AuditCheck[];
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
        <span className="text-[11px] font-medium text-foreground/85">
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

function SectionGroup({ step }: { step: Step }) {
  return (
    <details className="group border border-border rounded-lg overflow-hidden" open={step.hasMismatch}>
      <summary className="px-3 py-1.5 bg-muted/30 flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {step.hasMismatch ? (
          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{step.title}</span>
        {step.meta && <span className="text-[10px] text-muted-foreground/60">{step.meta}</span>}
        <span className="text-[10px] font-mono text-muted-foreground/70 ml-auto">{step.total}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="divide-y divide-border">
        {step.checks.map((c, idx) => (
          <CheckRow key={idx} c={c} />
        ))}
      </div>
    </details>
  );
}

function TestingRow({ title }: { title: string }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/30 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Testing {title}…
        </span>
      </div>
    </div>
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
  const [revealed, setRevealed] = useState(0);

  const report = useMemo(() => {
    if (!open) return null;
    return auditEstimate(items, settings, wetAreas, summary);
  }, [open, items, settings, wetAreas, summary]);

  const steps: Step[] = useMemo(() => {
    if (!report) return [];
    const scopeSteps: Step[] = report.scopes.map((r) => ({
      key: r.scope,
      hasMismatch: r.checks.some((c) => !c.pass),
      title: SCOPE_LABEL[r.scope] ?? r.scope,
      meta: `${r.itemsChecked} item${r.itemsChecked !== 1 ? "s" : ""} · ${r.consumablesChecked} consumable${r.consumablesChecked !== 1 ? "s" : ""}`,
      total: `$${r.independentTotal.toFixed(2)}`,
      checks: r.checks,
    }));
    return [
      ...scopeSteps,
      {
        key: "grand-total",
        hasMismatch: report.grandTotal.checks.some((c) => !c.pass),
        title: "Overhead / Mark-up / GST chain",
        total: `$${report.grandTotal.independentTotalExGst.toFixed(2)} ex-GST · $${report.grandTotal.independentGrandTotal.toFixed(2)} incl. GST`,
        checks: report.grandTotal.checks,
      },
    ];
  }, [report]);

  // Reveal one section at a time so the audit reads as testing each section in turn.
  useEffect(() => {
    if (!open || steps.length === 0) {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= steps.length) clearInterval(id);
    }, STEP_DELAY_MS);
    return () => clearInterval(id);
  }, [open, steps.length]);

  const done = steps.length > 0 && revealed >= steps.length;
  const totalMismatches = done ? steps.reduce((s, step) => s + step.checks.filter((c) => !c.pass).length, 0) : 0;

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
              {done && (
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

          {steps.length > 0 && (
            <div className="space-y-3 py-1">
              {steps.map((step, idx) =>
                idx < revealed ? (
                  <SectionGroup key={step.key} step={step} />
                ) : idx === revealed ? (
                  <TestingRow key={step.key} title={step.title} />
                ) : null
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
