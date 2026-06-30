import React from "react";
import type { EstimateItem, EstimateSettings, WetArea, Estimate } from "@/lib/estimate-types";
import {
  computeSummary,
  computeWetAreaLabor,
  itemMatCost,
  itemLabCost,
  itemTotal,
  itemMatQty,
} from "@/lib/estimate-types";
import { CATEGORIES } from "@/lib/takeoff-types";
import { cn } from "@/lib/utils";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uLabel = (u: string) => (u === "m2" ? "m²" : u);

// ── Table cells ───────────────────────────────────────────────────────────────
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide",
        "border-b border-border text-muted-foreground",
        "print:border-gray-200 print:text-gray-500",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
  bold,
  success,
}: {
  children?: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  bold?: boolean;
  success?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-1.5 text-xs border-b border-border print:border-gray-100",
        right ? "text-right tabular-nums" : "text-left",
        mono && "font-mono uppercase tracking-wide",
        bold && "font-semibold",
        success && "text-success print:text-green-700",
        !success && "text-foreground/90 print:text-gray-900",
      )}
    >
      {children}
    </td>
  );
}

// ── Waterfall ─────────────────────────────────────────────────────────────────
type WfVariant = "normal" | "indent" | "subtotal" | "total" | "gst-line" | "grand";

function WfRow({
  label,
  value,
  variant = "normal",
  positive,
  negative,
}: {
  label: string;
  value: string | number;
  variant?: WfVariant;
  positive?: boolean;
  negative?: boolean;
}) {
  const display = typeof value === "number" ? `$${fmt(value)}` : value;
  return (
    <tr
      className={cn(
        "border-b border-border print:border-gray-100",
        variant === "subtotal" && "bg-muted/20 print:bg-gray-50",
        variant === "total" && "bg-muted/30 print:bg-gray-100",
        variant === "gst-line" && "bg-muted/10 print:bg-transparent",
        variant === "grand" && "bg-primary/[0.07] print:bg-gray-50",
      )}
    >
      <td
        className={cn(
          "py-2 text-xs",
          variant === "indent"
            ? "pl-9 pr-4 text-foreground/90 print:text-gray-900"
            : "px-4 text-foreground/90 print:text-gray-700",
          variant === "subtotal" && "font-semibold text-foreground/80 print:text-gray-900",
          variant === "total" && "font-bold text-foreground/85 print:text-gray-900",
          variant === "gst-line" && "pl-9 pr-4 text-foreground/90 print:text-gray-900",
          variant === "grand" && "px-4 font-bold text-foreground/90 print:text-gray-900 text-sm",
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          "py-2 px-4 text-right tabular-nums",
          variant === "indent" || variant === "gst-line"
            ? "text-xs text-foreground/90 print:text-gray-900"
            : "text-xs text-foreground/90 print:text-gray-900",
          variant === "subtotal" && "font-semibold text-foreground/80 print:text-gray-900",
          variant === "total" && "font-bold text-foreground/85 print:text-gray-900",
          variant === "grand" && "text-base font-bold text-foreground/90 print:text-gray-900",
          positive && "text-success print:text-green-700",
          negative && "text-destructive print:text-red-700",
        )}
      >
        {display}
      </td>
    </tr>
  );
}

function WfSection({ title }: { title: string }) {
  return (
    <tr className="border-b border-border print:border-gray-200">
      <td colSpan={2} className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-primary/60 print:bg-gray-400 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-500">
            {title}
          </span>
        </div>
      </td>
    </tr>
  );
}

function WfDivider() {
  return (
    <tr>
      <td colSpan={2} className="border-t-2 border-border print:border-gray-300 py-0" />
    </tr>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export type ReportDocumentProps = {
  orgName: string;
  orgLogoUrl?: string | null;
  projectName: string;
  estimate: Estimate;
  items: EstimateItem[];
  wetAreas: WetArea[];
  mode: "summary" | "detailed";
  level?: string;
  today: string;
  /** Slot rendered in the controls bar (mode toggle + print button). Print-hidden by the component itself. */
  controls?: React.ReactNode;
};

// ── ReportDocument ────────────────────────────────────────────────────────────
export function ReportDocument({
  orgName,
  orgLogoUrl,
  projectName,
  estimate,
  items,
  wetAreas,
  mode,
  level,
  today,
  controls,
}: ReportDocumentProps) {
  const settings: EstimateSettings = {
    accounting_rate: estimate.accounting_rate,
    admin_rate: estimate.admin_rate,
    net_markup_pct: estimate.net_markup_pct,
    freight: estimate.freight,
    accommodation: estimate.accommodation,
    travel_allowance: estimate.travel_allowance,
    bailing_fee: estimate.bailing_fee,
    floor_prep_area: estimate.floor_prep_area ?? 0,
    floor_prep_depth_mm: estimate.floor_prep_depth_mm ?? 3,
    floor_prep_charge_per_bag: estimate.floor_prep_charge_per_bag ?? 0,
    floor_prep_mat_per_bag: estimate.floor_prep_mat_per_bag ?? 33,
    floor_prep_lab_per_bag: estimate.floor_prep_lab_per_bag ?? 40,
    grind_area: estimate.grind_area ?? 0,
    grind_labor_rate: estimate.grind_labor_rate ?? 0,
    grind_charge_rate: estimate.grind_charge_rate ?? 0,
  };

  const summary = computeSummary(items, settings, wetAreas);
  const totalCost =
    summary.subtotalAfterOverhead + summary.additionalCosts + summary.floorPrepCost + summary.grindCost;
  const grossProfit = summary.markupAmount + summary.floorPrepProfit + summary.grindProfit;
  const gm = summary.grossMarginPct;
  const gmLow = gm < 0.18;

  const totalMat = items.reduce((s, i) => s + itemMatCost(i), 0);
  const totalLab = items.reduce((s, i) => s + itemLabCost(i), 0);

  const primaries = items.filter((i) => i.type === "primary");
  const consumables = items.filter((i) => i.type === "consumable");
  const childrenByParent = new Map<string, EstimateItem[]>();
  consumables.forEach((c) => {
    if (!c.parent_item_id) return;
    const arr = childrenByParent.get(c.parent_item_id) ?? [];
    arr.push(c);
    childrenByParent.set(c.parent_item_id, arr);
  });

  const categoryStats = CATEGORIES.map((cat) => {
    const rows = primaries
      .filter((p) => p.scope_category === cat.key)
      .sort((a, b) => a.sort_order - b.sort_order);
    const catMat = rows.reduce((s, p) => {
      const ch = childrenByParent.get(p.id) ?? [];
      return s + itemMatCost(p) + ch.reduce((cs, c) => cs + itemMatCost(c), 0);
    }, 0);
    const catLab = rows.reduce((s, p) => {
      const ch = childrenByParent.get(p.id) ?? [];
      return s + itemLabCost(p) + ch.reduce((cs, c) => cs + itemLabCost(c), 0);
    }, 0);
    const m2Rows = rows.filter((p) => p.unit === "m2");
    const netSqm = m2Rows.reduce((s, p) => s + p.qty + (p.cov_area ?? 0), 0);
    const grossSqm = m2Rows.reduce((s, p) => s + itemMatQty(p), 0);
    // Primary unit = most common unit among primary rows (for non-m² categories like trims)
    const unitCounts: Record<string, number> = {};
    rows.forEach((p) => { unitCounts[p.unit] = (unitCounts[p.unit] ?? 0) + 1; });
    const primaryUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "m2";
    const primaryRows = rows.filter((p) => p.unit === primaryUnit);
    const netQty = primaryRows.reduce((s, p) => s + p.qty + (p.cov_area ?? 0), 0);
    const grossQty = primaryRows.reduce((s, p) => s + itemMatQty(p), 0);
    return { cat, rows, catMat, catLab, catTotal: catMat + catLab, netSqm, grossSqm, primaryUnit, netQty, grossQty };
  }).filter((g) => g.rows.length > 0);

  const itemsGrandTotal = categoryStats.reduce((s, c) => s + c.catTotal, 0);

  const additionalLines: [string, number][] = (
    [
      ["Freight", settings.freight],
      ["Accommodation", settings.accommodation],
      ["Travel Allowance", settings.travel_allowance],
      ["Bailing Fee", settings.bailing_fee],
    ] as [string, number][]
  ).filter(([, v]) => v > 0);

  return (
    <div className="space-y-5 print:space-y-4">
      {/* ── Document header ──────────────────────────────────────────── */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none print:shadow-none">
        <div className="h-0.5 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent print:bg-gray-800 print:h-[2px]" />
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-6">
          <div>
            {orgLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-10 max-w-[160px] object-contain mb-2 print:h-9"
              />
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 print:text-gray-600 mb-1.5">
                {orgName}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground print:text-gray-900 leading-none mb-1">
              {estimate.name}
            </h1>
            <p className="text-sm text-muted-foreground print:text-gray-500">{projectName}</p>
          </div>
          <div className="text-right shrink-0 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground print:text-gray-500 uppercase tracking-widest">
              Profit &amp; Loss Report
            </p>
            <p className="text-xs text-foreground/90 print:text-gray-900">{today}</p>
            <span
              className={cn(
                "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                estimate.status === "approved"
                  ? "bg-success/15 text-success border-success/30 print:bg-green-50 print:text-green-700 print:border-green-300"
                  : estimate.status === "sent"
                  ? "bg-info/15 text-info border-info/30 print:bg-blue-50 print:text-blue-700 print:border-blue-300"
                  : "bg-muted/50 text-muted-foreground border-border print:bg-gray-100 print:text-gray-500 print:border-gray-300",
              )}
            >
              {estimate.status ?? "Draft"}
            </span>
          </div>
        </div>
        <div className="px-6 py-2.5 border-t border-border print:border-gray-200 bg-muted/20 print:bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground print:text-gray-500">
              {mode === "detailed" ? "Detailed" : "Summary"}
            </span>
            {level && level !== "all" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
                {level}
              </span>
            )}
            <span className="text-[10px] text-foreground/90 print:text-gray-900">
              All amounts exclusive of GST unless stated
            </span>
          </div>
          {controls && <div className="print:hidden">{controls}</div>}
        </div>
      </div>

      {/* ── Key metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 print:gap-2">
        {/* Contract Value */}
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none">
          <div className="h-0.5 bg-secondary/60 print:bg-gray-300" />
          <div className="px-4 pt-3.5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground print:text-gray-500 mb-2">
              Contract Value
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground print:text-gray-900 leading-none">
              ${fmt(summary.totalExGst)}
            </p>
            <p className="text-[11px] text-foreground/90 print:text-gray-900 mt-1.5">
              ex-GST · ${fmt(summary.grandTotal)} inc. GST
            </p>
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none">
          <div className="h-0.5 bg-muted-foreground/30 print:bg-gray-300" />
          <div className="px-4 pt-3.5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground print:text-gray-500 mb-2">
              Total Cost
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground/85 print:text-gray-900 leading-none">
              ${fmt(totalCost)}
            </p>
            <p className="text-[11px] text-foreground/90 print:text-gray-900 mt-1.5">
              ex-GST · incl. overheads
            </p>
          </div>
        </div>

        {/* Profit $ */}
        <div
          className={cn(
            "bg-card/65 backdrop-blur-xl border rounded-sm overflow-hidden print:bg-white print:rounded-none",
            gmLow
              ? "border-warning/30 print:border-amber-200"
              : "border-success/25 print:border-green-200",
          )}
        >
          <div className={cn("h-0.5", gmLow ? "bg-warning/60 print:bg-amber-400" : "bg-success/60 print:bg-green-400")} />
          <div className="px-4 pt-3.5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground print:text-gray-500 mb-2">
              Profit
            </p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums leading-none",
                gmLow ? "text-warning print:text-amber-700" : "text-success print:text-green-700",
              )}
            >
              ${fmt(grossProfit)}
            </p>
            <p className="text-[11px] text-foreground/90 print:text-gray-900 mt-1.5">ex-GST</p>
          </div>
        </div>

        {/* Margin % */}
        <div
          className={cn(
            "backdrop-blur-xl border rounded-sm overflow-hidden print:rounded-none",
            gmLow
              ? "bg-warning/[0.08] border-warning/30 print:bg-amber-50 print:border-amber-200"
              : "bg-success/[0.07] border-success/25 print:bg-green-50 print:border-green-200",
          )}
        >
          <div className={cn("h-0.5", gmLow ? "bg-warning/80 print:bg-amber-400" : "bg-success/80 print:bg-green-400")} />
          <div className="px-4 pt-3.5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground print:text-gray-500 mb-2">
              Margin
            </p>
            <p
              className={cn(
                "text-3xl font-bold tabular-nums leading-none",
                gmLow ? "text-warning print:text-amber-700" : "text-success print:text-green-700",
              )}
            >
              {fmtPct(gm)}%
            </p>
            <p
              className={cn(
                "text-[11px] mt-1.5 font-semibold tabular-nums",
                gmLow ? "text-warning/70 print:text-amber-600" : "text-success/70 print:text-green-600",
              )}
            >
              {gmLow ? "Below target" : "Gross margin"}
            </p>
          </div>
        </div>
      </div>

      {/* ── P&L Waterfall ────────────────────────────────────────────── */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none">
        <table className="w-full">
          <colgroup>
            <col />
            <col className="w-44" />
          </colgroup>
          <tbody>
            <WfSection title="Cost of Sales" />
            <WfRow label="Materials" value={totalMat} />
            <WfRow label="Labour" value={totalLab} variant="indent" />
            {summary.wetAreasCount > 0 && (
              <WfRow
                label={`Wet Areas — ${summary.wetAreasCount} type${summary.wetAreasCount !== 1 ? "s" : ""} (net)`}
                value={summary.wetAreasProfit}
                variant="indent"
                positive={summary.wetAreasProfit >= 0}
                negative={summary.wetAreasProfit < 0}
              />
            )}
            <WfRow
              label={`Accounting (${fmtPct(settings.accounting_rate)}%)`}
              value={summary.accountingCost}
              variant="indent"
            />
            <WfRow
              label={`Admin (${fmtPct(settings.admin_rate)}%)`}
              value={summary.adminCost}
              variant="indent"
            />
            <WfRow label="Subtotal" value={summary.subtotalAfterOverhead} variant="subtotal" />

            {additionalLines.map(([label, val]) => (
              <WfRow key={label} label={label} value={val} variant="indent" />
            ))}
            {summary.floorPrepBags > 0 && (
              <WfRow
                label={`Floor Prep — ${summary.floorPrepBags} bag${summary.floorPrepBags !== 1 ? "s" : ""}`}
                value={summary.floorPrepCost}
                variant="indent"
              />
            )}
            {summary.grindCost > 0 && (
              <WfRow
                label={`Grinding — ${fmt(settings.grind_area)} m²`}
                value={summary.grindCost}
                variant="indent"
              />
            )}
            <WfRow label="Total Cost" value={totalCost} variant="total" />

            <WfDivider />

            <WfSection title="Profitability" />
            <WfRow
              label={`Mark-up (${fmtPct(settings.net_markup_pct)}%)`}
              value={summary.markupAmount}
              positive
            />
            {summary.floorPrepBags > 0 && summary.floorPrepProfit > 0 && (
              <WfRow
                label={`Floor Prep profit (${summary.floorPrepBags} bags)`}
                value={summary.floorPrepProfit}
                variant="indent"
                positive
              />
            )}
            {summary.grindProfit !== 0 && settings.grind_area > 0 && (
              <WfRow
                label={`Grinding profit (${fmt(settings.grind_area)} m²)`}
                value={summary.grindProfit}
                variant="indent"
                positive={summary.grindProfit > 0}
                negative={summary.grindProfit < 0}
              />
            )}
            <WfRow label="Gross Profit" value={grossProfit} variant="subtotal" positive />
            <WfRow label="Gross Margin" value={`${fmtPct(gm)}%`} variant="subtotal" positive={!gmLow} />

            <WfDivider />

            <WfRow label="Total (ex-GST)" value={summary.totalExGst} variant="total" />
            <WfRow label="+ GST (10%)" value={summary.gst} variant="gst-line" />

            {/* Grand total */}
            <tr className="bg-primary/[0.07] print:bg-gray-100 border-t-2 border-primary/20 print:border-gray-400">
              <td className="px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/80 print:text-gray-900">
                  Grand Total
                </p>
                <p className="text-[10px] text-foreground/90 print:text-gray-900 mt-0.5">Including GST</p>
              </td>
              <td className="px-4 py-4 text-right">
                <p className="text-2xl font-bold tabular-nums text-foreground print:text-gray-900">
                  ${fmt(summary.grandTotal)}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Category breakdown & sell rates ─────────────────────────── */}
      {categoryStats.length > 0 && (
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none print:break-inside-avoid">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 print:bg-gray-50 border-b border-border print:border-gray-200">
            <div className="w-0.5 h-3.5 rounded-full bg-primary/60 print:bg-gray-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground print:text-gray-500">
              Category Breakdown &amp; Sell Rates (ex-GST)
            </span>
          </div>
          <table className="w-full">
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="bg-muted/15 print:bg-gray-50">
                <Th>Category</Th>
                <Th right>Materials</Th>
                <Th right>Labour</Th>
                <Th right>Total cost</Th>
                <Th right>Gross qty (incl. waste)</Th>
                <Th right>Sell price</Th>
                <Th right>Per unit rate</Th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map(({ cat, catMat, catLab, catTotal, primaryUnit, netQty, grossQty }) => {
                const itemsComponent = summary.totalExGst - summary.floorPrepRevenue - summary.grindRevenue;
                const catShare = itemsGrandTotal > 0 ? catTotal / itemsGrandTotal : 0;
                const catAllocated = catShare * itemsComponent;
                const perUnit = grossQty > 0 ? catAllocated / grossQty : 0;
                return (
                  <tr key={cat.key} className="border-b border-border print:border-gray-100 hover:bg-muted/10 print:hover:bg-transparent">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-0.5 h-3 rounded-full bg-primary/40 print:bg-gray-300 shrink-0" />
                        <span className="text-xs font-medium text-foreground/90 print:text-gray-700">
                          {cat.label}
                        </span>
                      </div>
                    </td>
                    <Td right>${fmt(catMat)}</Td>
                    <Td right>${fmt(catLab)}</Td>
                    <Td right bold>${fmt(catTotal)}</Td>
                    <Td right>{grossQty > 0 ? `${fmt(grossQty)} ${uLabel(primaryUnit)}` : "—"}</Td>
                    <Td right>${fmt(catAllocated)}</Td>
                    <Td right bold>{grossQty > 0 ? `$${fmt(perUnit)} / ${uLabel(primaryUnit)}` : "—"}</Td>
                  </tr>
                );
              })}
              {summary.floorPrepBags > 0 && (
                <tr className="border-b border-border print:border-gray-100 hover:bg-muted/10 print:hover:bg-transparent">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-3 rounded-full bg-primary/40 print:bg-gray-300 shrink-0" />
                      <span className="text-xs font-medium text-foreground/90 print:text-gray-700">
                        Floor Prep ({summary.floorPrepBags} bag{summary.floorPrepBags !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </td>
                  <Td right>${fmt(summary.floorPrepCost)}</Td>
                  <Td right>—</Td>
                  <Td right bold>${fmt(summary.floorPrepCost)}</Td>
                  <Td right>—</Td>
                  <Td right>${fmt(summary.floorPrepRevenue)}</Td>
                  <Td right>—</Td>
                </tr>
              )}
              {summary.grindCost > 0 && (
                <tr className="border-b border-border print:border-gray-100 hover:bg-muted/10 print:hover:bg-transparent">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-3 rounded-full bg-primary/40 print:bg-gray-300 shrink-0" />
                      <span className="text-xs font-medium text-foreground/90 print:text-gray-700">
                        Grinding ({fmt(settings.grind_area)} m²)
                      </span>
                    </div>
                  </td>
                  <Td right>${fmt(summary.grindCost)}</Td>
                  <Td right>—</Td>
                  <Td right bold>${fmt(summary.grindCost)}</Td>
                  <Td right>—</Td>
                  <Td right>${fmt(summary.grindRevenue)}</Td>
                  <Td right>—</Td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/25 print:bg-gray-100 border-t-2 border-border print:border-gray-300">
                <td className="px-3 py-2 text-xs font-bold text-foreground/90 print:text-gray-900 uppercase tracking-wide">
                  Total
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-foreground/70 print:text-gray-700">
                  ${fmt(categoryStats.reduce((s, c) => s + c.catMat, 0) + (summary.floorPrepBags > 0 ? summary.floorPrepCost : 0) + summary.grindCost)}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-foreground/70 print:text-gray-700">
                  ${fmt(categoryStats.reduce((s, c) => s + c.catLab, 0))}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums font-bold text-foreground/85 print:text-gray-900">
                  ${fmt(itemsGrandTotal + (summary.floorPrepBags > 0 ? summary.floorPrepCost : 0) + summary.grindCost)}
                </td>
                <td />
                <td className="px-3 py-2 text-right text-sm tabular-nums font-bold text-foreground/85 print:text-gray-900">
                  ${fmt(summary.totalExGst)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Detailed line items ───────────────────────────────────────── */}
      {mode === "detailed" && categoryStats.length > 0 && (
        <div className="space-y-3">
          {categoryStats.map(({ cat, rows, catMat, catLab, catTotal }) => (
            <div
              key={cat.key}
              className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none print:break-inside-avoid"
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 print:bg-gray-50 border-b border-border print:border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-3.5 rounded-full bg-primary/60 print:bg-gray-400 shrink-0" />
                  <span className="text-[11px] font-bold text-foreground/80 print:text-gray-700 uppercase tracking-widest">
                    {cat.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums text-foreground/90 print:text-gray-900">
                  <span>Mat ${fmt(catMat)}</span>
                  <span>Lab ${fmt(catLab)}</span>
                  <span className="font-semibold text-foreground/80 print:text-gray-700">${fmt(catTotal)}</span>
                </div>
              </div>

              <table className="w-full">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-20" />
                  <col />
                  <col className="w-20" />
                  <col className="w-10" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/15 print:bg-gray-50">
                    <Th>#</Th>
                    <Th>Code</Th>
                    <Th>Description</Th>
                    <Th right>Eff. Qty</Th>
                    <Th>Unit</Th>
                    <Th right>Mat $</Th>
                    <Th right>Lab $</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((primary, idx) => {
                    const children = (childrenByParent.get(primary.id) ?? []).sort(
                      (a, b) => a.sort_order - b.sort_order,
                    );
                    const pMat = itemMatCost(primary);
                    const pLab = itemLabCost(primary);
                    const groupMat = pMat + children.reduce((s, c) => s + itemMatCost(c), 0);
                    const groupLab = pLab + children.reduce((s, c) => s + itemLabCost(c), 0);
                    const effQty = itemMatQty(primary);

                    return (
                      <React.Fragment key={primary.id}>
                        <tr className="border-b border-border print:border-gray-100 bg-muted/[0.04] print:bg-transparent hover:bg-muted/10 print:hover:bg-transparent">
                          <Td>{idx + 1}</Td>
                          <Td mono>{primary.finish_code ?? "—"}</Td>
                          <Td bold>
                            {primary.manufacturer && (
                              <span className="mr-1.5 text-[10px] font-normal text-foreground/90 print:text-gray-900">
                                {primary.manufacturer}
                              </span>
                            )}
                            {primary.description ?? "—"}
                          </Td>
                          <Td right>{effQty > 0 ? fmt(effQty) : "—"}</Td>
                          <Td>{uLabel(primary.unit)}</Td>
                          <Td right>{pMat > 0 ? `$${fmt(pMat)}` : "—"}</Td>
                          <Td right>{pLab > 0 ? `$${fmt(pLab)}` : "—"}</Td>
                          <Td right bold>
                            {itemTotal(primary) > 0 ? `$${fmt(itemTotal(primary))}` : "—"}
                          </Td>
                        </tr>

                        {children.map((child) => {
                          const cMat = itemMatCost(child);
                          const cLab = itemLabCost(child);
                          return (
                            <tr key={child.id} className="border-b border-border print:border-gray-100 hover:bg-muted/10 print:hover:bg-transparent">
                              <Td>↳</Td>
                              <Td>—</Td>
                              <Td>{child.description ?? "—"}</Td>
                              <Td right>
                                {child.qty > 0 ? `${child.qty} ${uLabel(child.unit)}` : "—"}
                              </Td>
                              <Td>{uLabel(child.unit)}</Td>
                              <Td right>{cMat > 0 ? `$${fmt(cMat)}` : "—"}</Td>
                              <Td right>{cLab > 0 ? `$${fmt(cLab)}` : "—"}</Td>
                              <Td right>
                                {itemTotal(child) > 0 ? `$${fmt(itemTotal(child))}` : "—"}
                              </Td>
                            </tr>
                          );
                        })}

                        {children.length > 0 && (
                          <tr className="border-b border-dashed border-border print:border-gray-200 bg-primary/[0.03] print:bg-gray-50">
                            <td colSpan={5} className="px-3 py-1.5 text-right text-[10px] font-semibold text-foreground/90 print:text-gray-900 uppercase tracking-wide">
                              {primary.finish_code || primary.description || `#${idx + 1}`} subtotal
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs tabular-nums text-foreground/90 print:text-gray-900">
                              ${fmt(groupMat)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs tabular-nums text-foreground/90 print:text-gray-900">
                              ${fmt(groupLab)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs tabular-nums font-semibold text-foreground/90 print:text-gray-900">
                              ${fmt(groupMat + groupLab)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <tr className="bg-muted/25 print:bg-gray-100 border-t-2 border-border print:border-gray-300">
                    <td colSpan={5} className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground print:text-gray-500 uppercase tracking-wide">
                      {cat.label} total
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-foreground/70 print:text-gray-700">
                      ${fmt(catMat)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-foreground/70 print:text-gray-700">
                      ${fmt(catLab)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums font-bold text-foreground/85 print:text-gray-900">
                      ${fmt(catTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Wet Areas */}
          {wetAreas.length > 0 && (
            <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden print:bg-white print:border-gray-200 print:rounded-none print:break-inside-avoid">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 print:bg-gray-50 border-b border-border print:border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-3.5 rounded-full bg-primary/60 print:bg-gray-400 shrink-0" />
                  <span className="text-[11px] font-bold text-foreground/80 print:text-gray-700 uppercase tracking-widest">
                    Wet Areas
                  </span>
                </div>
                <span className={cn(
                  "text-xs tabular-nums font-semibold",
                  summary.wetAreasProfit >= 0 ? "text-success print:text-green-700" : "text-destructive print:text-red-700",
                )}>
                  Net: {summary.wetAreasProfit >= 0 ? "+" : ""}${fmt(summary.wetAreasProfit)}
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/15 print:bg-gray-50">
                    <Th>Name</Th>
                    <Th right>Qty</Th>
                    <Th right>Charge / ea</Th>
                    <Th right>Total Charge</Th>
                    <Th right>Labour Cost</Th>
                    <Th right>Net</Th>
                  </tr>
                </thead>
                <tbody>
                  {wetAreas.map((wa) => {
                    const labCostEa = computeWetAreaLabor(wa);
                    const qty = Number(wa.qty) || 1;
                    const charge = Number(wa.charge) || 0;
                    const totalCharge = charge * qty;
                    const totalLabor = labCostEa * qty;
                    const net = totalCharge - totalLabor;
                    return (
                      <tr key={wa.id} className="border-b border-border print:border-gray-100 hover:bg-muted/10 print:hover:bg-transparent">
                        <Td>{wa.name}</Td>
                        <Td right>{qty}</Td>
                        <Td right>{charge > 0 ? `$${fmt(charge)}` : "—"}</Td>
                        <Td right>{totalCharge > 0 ? `$${fmt(totalCharge)}` : "—"}</Td>
                        <Td right>{totalLabor > 0 ? `$${fmt(totalLabor)}` : "—"}</Td>
                        <Td right success={net >= 0}>{net >= 0 ? "+" : ""}${fmt(net)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer (print only) */}
      <div className="hidden print:flex items-center justify-between border-t border-gray-200 pt-3 mt-4">
        <p className="text-[9px] text-gray-600">
          {orgName} · {projectName} · {estimate.name}{level && level !== "all" ? ` · ${level}` : ""}
        </p>
        <p className="text-[9px] text-gray-600">
          All amounts exclusive of GST unless stated · Generated {today}
        </p>
      </div>
    </div>
  );
}
