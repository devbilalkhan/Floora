"use client";

import { useMemo } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOOR_PREP } from "@/lib/default-rates";
import type { EstimateSettings } from "@/lib/estimate-types";

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => parseFloat((n || 0).toFixed(2));

const rateInput =
  "w-14 text-xs text-right tabular-nums bg-input border border-border rounded px-1.5 py-1 " +
  "text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/25";

type Props = {
  area: number;
  depthMm: number;
  chargePerBag: number;
  matPerBag: number;
  labPerBag: number;
  grindArea: number;
  grindLaborRate: number;
  grindChargeRate: number;
  onUpdate: (patch: Partial<EstimateSettings>) => void;
  onReset: () => void;
};

export function FloorPrepPanel({ area, depthMm, chargePerBag, matPerBag, labPerBag, grindArea, grindLaborRate, grindChargeRate, onUpdate, onReset }: Props) {
  const bags = useMemo(
    () =>
      area > 0 && depthMm > 0
        ? Math.ceil((area * depthMm) / FLOOR_PREP.bagsDiv)
        : 0,
    [area, depthMm]
  );

  const matCost = matPerBag * bags;
  const labCost = labPerBag * bags;
  const totalCost = matCost + labCost;
  const revenue = chargePerBag * bags;
  const profit = revenue - totalCost;

  const hasResult = bags > 0;

  const grindCost = grindArea * grindLaborRate;
  const grindRevenue = grindArea * grindChargeRate;
  const grindProfit = grindRevenue - grindCost;
  const hasGrind = grindArea > 0;

  return (
    <div className="w-72 shrink-0 sticky top-4 self-start">
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <Layers className="h-3.5 w-3.5 text-primary/70 shrink-0" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Floor Preparation
          </span>
          <button
            onClick={onReset}
            className="ml-auto text-[10px] text-primary/50 hover:text-primary transition-colors underline underline-offset-2"
          >
            reset
          </button>
        </div>

        {/* Inputs */}
        <div className="px-4 py-4 space-y-3.5">
          <div className="flex gap-3">
            <label className="flex flex-col gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Area
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={area === 0 ? "" : r2(area)}
                  onChange={(e) => onUpdate({ floor_prep_area: parseFloat(e.target.value) || 0 })}
                  className="flex-1 min-w-0 text-xs text-right tabular-nums bg-input border border-border rounded px-2 py-1.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/25"
                  placeholder="0"
                  min={0}
                  step={1}
                />
                <span className="text-xs text-muted-foreground/50 shrink-0">m²</span>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 w-24 shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Depth
              </span>
              <select
                value={depthMm}
                onChange={(e) => onUpdate({ floor_prep_depth_mm: Number(e.target.value) })}
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((mm) => (
                  <option key={mm} value={mm}>{mm} mm</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Client Charge / Bag
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/50 shrink-0">$</span>
              <input
                type="number"
                value={chargePerBag === 0 ? "" : r2(chargePerBag)}
                onChange={(e) => onUpdate({ floor_prep_charge_per_bag: parseFloat(e.target.value) || 0 })}
                className="flex-1 text-xs text-right tabular-nums bg-input border border-border rounded px-2 py-1.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/25"
                placeholder="0.00"
                min={0}
                step={0.01}
              />
            </div>
          </label>
        </div>

        {/* Results */}
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Bags count */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Bags Required
            </span>
            <span className={cn(
              "font-bold tabular-nums",
              hasResult ? "text-sm text-foreground/90" : "text-sm text-muted-foreground/25"
            )}>
              {hasResult ? (
                <>
                  {bags}
                  <span className="text-xs font-normal text-muted-foreground/50 ml-1">bags</span>
                </>
              ) : "—"}
            </span>
          </div>

          {/* Cost breakdown — always visible so rates are editable */}
          <div className="space-y-2 pt-1 border-t border-black/10 dark:border-white/10">
            <p className="text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
              Cost Breakdown
            </p>

            {/* Material rate row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground/55 shrink-0">Material</span>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[9px] text-muted-foreground/35">$</span>
                <input
                  type="number"
                  value={matPerBag === 0 ? "" : r2(matPerBag)}
                  onChange={(e) => onUpdate({ floor_prep_mat_per_bag: parseFloat(e.target.value) || 0 })}
                  className={rateInput}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
                <span className="text-[9px] text-muted-foreground/35">/bag</span>
              </div>
              <span className={cn(
                "tabular-nums text-[11px] w-16 text-right",
                hasResult ? "text-foreground/55" : "text-muted-foreground/25"
              )}>
                {hasResult ? `$${fmt(matCost)}` : "—"}
              </span>
            </div>

            {/* Labour rate row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground/55 shrink-0">Labour</span>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[9px] text-muted-foreground/35">$</span>
                <input
                  type="number"
                  value={labPerBag === 0 ? "" : r2(labPerBag)}
                  onChange={(e) => onUpdate({ floor_prep_lab_per_bag: parseFloat(e.target.value) || 0 })}
                  className={rateInput}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
                <span className="text-[9px] text-muted-foreground/35">/bag</span>
              </div>
              <span className={cn(
                "tabular-nums text-[11px] w-16 text-right",
                hasResult ? "text-foreground/55" : "text-muted-foreground/25"
              )}>
                {hasResult ? `$${fmt(labCost)}` : "—"}
              </span>
            </div>

            <div className="flex justify-between text-[11px] pt-1.5 border-t border-black/10 dark:border-white/10">
              <span className="text-foreground/60 font-medium">Total Cost</span>
              <span className={cn(
                "tabular-nums font-medium",
                hasResult ? "text-foreground/60" : "text-muted-foreground/25"
              )}>
                {hasResult ? `$${fmt(totalCost)}` : "—"}
              </span>
            </div>
          </div>

          {hasResult && (
            <>
              {/* Revenue */}
              <div className="flex justify-between text-[11px] border-t border-black/10 dark:border-white/10 pt-0.5">
                <span className="text-muted-foreground/60">Client Revenue</span>
                <span className="tabular-nums text-foreground/65">${fmt(revenue)}</span>
              </div>

              {/* Profit highlight */}
              <div className={cn(
                "rounded-lg px-3 py-2.5 flex items-center justify-between",
                profit > 0
                  ? "bg-success/10 border border-success/20"
                  : profit < 0
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-muted/20 border border-border"
              )}>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                    Net Profit
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                    Adds to estimate margin
                  </p>
                </div>
                <p className={cn(
                  "text-base font-bold tabular-nums",
                  profit > 0 ? "text-success" : profit < 0 ? "text-destructive" : "text-foreground/50"
                )}>
                  ${fmt(profit)}
                </p>
              </div>
            </>
          )}

          {!hasResult && (
            <p className="text-[10px] text-muted-foreground/30 text-center py-2">
              Enter area &amp; depth to calculate
            </p>
          )}
        </div>

        {/* ── Grinding ───────────────────────────────────────────── */}
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Grinding
          </p>

          {/* Area + rates row */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/55 w-12 shrink-0">Area</span>
              <input
                type="number"
                value={grindArea === 0 ? "" : r2(grindArea)}
                onChange={(e) => onUpdate({ grind_area: parseFloat(e.target.value) || 0 })}
                className="flex-1 min-w-0 text-xs text-right tabular-nums bg-input border border-border rounded px-2 py-1 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/25"
                placeholder="0"
                min={0}
              />
              <span className="text-[10px] text-muted-foreground/50 shrink-0">m²</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/55 w-12 shrink-0">Labour</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-[9px] text-muted-foreground/35">$</span>
                <input
                  type="number"
                  value={grindLaborRate === 0 ? "" : r2(grindLaborRate)}
                  onChange={(e) => onUpdate({ grind_labor_rate: parseFloat(e.target.value) || 0 })}
                  className={rateInput}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
                <span className="text-[9px] text-muted-foreground/35">/m²</span>
              </div>
              <span className={cn("tabular-nums text-[11px] w-16 text-right", hasGrind ? "text-foreground/55" : "text-muted-foreground/25")}>
                {hasGrind ? `$${fmt(grindCost)}` : "—"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/55 w-12 shrink-0">Charge</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-[9px] text-muted-foreground/35">$</span>
                <input
                  type="number"
                  value={grindChargeRate === 0 ? "" : r2(grindChargeRate)}
                  onChange={(e) => onUpdate({ grind_charge_rate: parseFloat(e.target.value) || 0 })}
                  className={rateInput}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
                <span className="text-[9px] text-muted-foreground/35">/m²</span>
              </div>
              <span className={cn("tabular-nums text-[11px] w-16 text-right", hasGrind ? "text-foreground/65" : "text-muted-foreground/25")}>
                {hasGrind ? `$${fmt(grindRevenue)}` : "—"}
              </span>
            </div>
          </div>

          {hasGrind && (
            <div className={cn(
              "rounded-lg px-3 py-2.5 flex items-center justify-between",
              grindProfit > 0
                ? "bg-success/10 border border-success/20"
                : grindProfit < 0
                ? "bg-destructive/10 border border-destructive/20"
                : "bg-muted/20 border border-border"
            )}>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                  Grind Profit
                </p>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                  Adds to estimate margin
                </p>
              </div>
              <p className={cn(
                "text-base font-bold tabular-nums",
                grindProfit > 0 ? "text-success" : grindProfit < 0 ? "text-destructive" : "text-foreground/50"
              )}>
                ${fmt(grindProfit)}
              </p>
            </div>
          )}

          {!hasGrind && (
            <p className="text-[10px] text-muted-foreground/30 text-center py-1">
              Enter area to calculate
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
