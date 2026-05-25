"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportCharts } from "./report-charts";
import type { ChartProject, TimelinePoint } from "./report-charts";

export type ProjectReportData = {
  id: string;
  name: string;
  head_client: string | null;
  brand: string;
  // Estimate
  estimateName: string | null;
  estRevenue: number;
  estCostBase: number;
  estOtherCosts: number;
  estMargin: number;
  estMarginPct: number;     // 0–1 decimal (e.g. 0.22)
  // Actuals
  actIncome: number;
  actCost: number;
  actAdminFee: number;
  actMargin: number;
  actMarginPct: number | null;  // percentage 0–100 (e.g. 18.5)
  // Timeline
  actualsTimeline: TimelinePoint[];
};

type ViewMode = "estimates" | "actuals";

function fmtAU(n: number) {
  return (
    "$" +
    Math.abs(n).toLocaleString("en-AU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export function ReportView({
  projects,
  combinedTimeline,
}: {
  projects: ProjectReportData[];
  combinedTimeline: TimelinePoint[];
}) {
  const [view, setView] = useState<ViewMode>("estimates");

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = projects.reduce(
    (acc, p) =>
      view === "estimates"
        ? {
            revenue: acc.revenue + p.estRevenue,
            cost: acc.cost + p.estCostBase + p.estOtherCosts,
            margin: acc.margin + p.estMargin,
          }
        : {
            revenue: acc.revenue + p.actIncome,
            cost: acc.cost + p.actCost + p.actAdminFee,
            margin: acc.margin + p.actMargin,
          },
    { revenue: 0, cost: 0, margin: 0 }
  );
  const totalMarginPct =
    totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : 0;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartProjects: ChartProject[] = projects.map((p) =>
    view === "estimates"
      ? {
          name: p.name,
          estimate: p.estRevenue,
          actualIncome: p.actIncome > 0 ? p.actIncome : undefined,
          actualCost: p.actCost > 0 ? p.actCost : undefined,
          estGpPct: p.estMarginPct * 100,
          actGpPct: p.actMarginPct,
        }
      : {
          name: p.name,
          estimate: undefined,
          actualIncome: p.actIncome > 0 ? p.actIncome : undefined,
          actualCost: p.actCost > 0 ? p.actCost : undefined,
          estGpPct: undefined,
          actGpPct: p.actMarginPct,
        }
  );

  const hasActualsData = projects.some((p) => p.actIncome > 0 || p.actCost > 0);

  return (
    <div className="space-y-5">
      {/* View selector */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {projects.length} project{projects.length !== 1 ? "s" : ""} selected
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Show:</span>
          <Select
            value={view}
            onValueChange={(v) => setView(v as ViewMode)}
          >
            <SelectTrigger className="h-7 text-xs w-[130px] border-black/10 dark:border-white/10 bg-card/65 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="estimates" className="text-xs">Estimates</SelectItem>
              <SelectItem value="actuals" className="text-xs">Actuals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label={view === "estimates" ? "Total Revenue" : "Total Income"}
          value={fmtAU(totals.revenue)}
          sub="ex-GST"
        />
        <KpiCard
          label={view === "estimates" ? "Total Cost" : "Total Expenses"}
          value={fmtAU(totals.cost)}
          sub={view === "estimates" ? "mat · lab · overhead" : "all expenses"}
        />
        <KpiCard
          label="Total Margin"
          value={fmtAU(totals.margin)}
          sub={`${totalMarginPct.toFixed(1)}% of ${view === "estimates" ? "revenue" : "income"}`}
          highlight={totals.margin >= 0 ? "green" : "orange"}
        />
        <KpiCard
          label={view === "estimates" ? "Est. Margin %" : "Act. Margin %"}
          value={`${totalMarginPct.toFixed(1)}%`}
          sub={view === "estimates" ? "across all estimates" : "across all actuals"}
          highlight={totalMarginPct >= 15 ? "green" : undefined}
        />
      </div>

      {/* Charts */}
      <ReportCharts projects={chartProjects} timeline={combinedTimeline} />

      {/* Summary table */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
              <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Project
              </th>
              {view === "estimates" ? (
                <>
                  <th className="text-left px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Estimate
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Revenue
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Cost
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Other
                  </th>
                </>
              ) : (
                <>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Income
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Expenses
                  </th>
                  <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Admin Fee
                  </th>
                </>
              )}
              <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Margin
              </th>
              {view === "actuals" && (
                <th className="text-right px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Margin %
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const margin = view === "estimates" ? p.estMargin : p.actMargin;
              const marginPct =
                view === "estimates"
                  ? p.estMarginPct * 100
                  : p.actMarginPct;
              const revenue = view === "estimates" ? p.estRevenue : p.actIncome;
              const hasData = view === "estimates" ? p.estRevenue > 0 : p.actIncome > 0 || p.actCost > 0;

              return (
                <tr
                  key={p.id}
                  className="border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-2 py-1.5">
                    <p className="text-[11px] font-medium text-foreground/70 truncate max-w-[180px]">
                      {p.name}
                    </p>
                    {p.head_client && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {p.head_client}
                      </p>
                    )}
                  </td>

                  {view === "estimates" ? (
                    <>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                        {p.estimateName ?? (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-foreground/70">
                        {p.estRevenue > 0 ? (
                          fmtAU(p.estRevenue)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {p.estCostBase > 0 ? (
                          fmtAU(p.estCostBase)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {p.estOtherCosts > 0 ? (
                          fmtAU(p.estOtherCosts)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-foreground/70">
                        {p.actIncome > 0 ? (
                          fmtAU(p.actIncome)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {p.actCost > 0 ? (
                          fmtAU(p.actCost)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {p.actAdminFee > 0 ? (
                          fmtAU(p.actAdminFee)
                        ) : (
                          <span className="text-muted-foreground/45">—</span>
                        )}
                      </td>
                    </>
                  )}

                  {/* Margin */}
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums font-medium">
                    {hasData ? (
                      <span className={margin >= 0 ? "text-success" : "text-warning"}>
                        {fmtAU(margin)}
                        {view === "estimates" && marginPct != null && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            {marginPct.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/45">—</span>
                    )}
                  </td>
                  {view === "actuals" && (
                    <td className="px-2 py-1.5 text-[11px] text-right tabular-nums hidden sm:table-cell">
                      {hasData && marginPct != null ? (
                        <span className={marginPct >= 0 ? "text-success" : "text-warning"}>
                          {marginPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/45">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="border-t border-black/10 dark:border-white/10 bg-muted/20">
              <td className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Total ({projects.length})
              </td>
              {view === "estimates" ? (
                <>
                  <td className="hidden sm:table-cell" />
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums font-semibold text-foreground/75">
                    {fmtAU(totals.revenue)}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {fmtAU(
                      projects.reduce((s, p) => s + p.estCostBase, 0)
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {projects.some((p) => p.estOtherCosts > 0)
                      ? fmtAU(projects.reduce((s, p) => s + p.estOtherCosts, 0))
                      : <span className="text-muted-foreground/45">—</span>}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums font-semibold text-foreground/75">
                    {fmtAU(totals.revenue)}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {fmtAU(projects.reduce((s, p) => s + p.actCost, 0))}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {projects.some((p) => p.actAdminFee > 0)
                      ? fmtAU(projects.reduce((s, p) => s + p.actAdminFee, 0))
                      : <span className="text-muted-foreground/45">—</span>}
                  </td>
                </>
              )}
              <td className="px-2 py-1.5 text-[11px] text-right tabular-nums font-semibold">
                <span className={totals.margin >= 0 ? "text-success" : "text-warning"}>
                  {fmtAU(totals.margin)}
                  {view === "estimates" && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      {totalMarginPct.toFixed(1)}%
                    </span>
                  )}
                </span>
              </td>
              {view === "actuals" && (
                <td className="px-2 py-1.5 text-[11px] text-right tabular-nums font-semibold hidden sm:table-cell">
                  <span className={totalMarginPct >= 0 ? "text-success" : "text-warning"}>
                    {totalMarginPct.toFixed(1)}%
                  </span>
                </td>
              )}
            </tr>
          </tfoot>
        </table>

        {/* Column legend */}
        {view === "estimates" && (
          <div className="flex items-center gap-4 flex-wrap px-3 py-1.5 border-t border-black/[0.05] dark:border-white/[0.05] bg-card/40">
            <span className="text-[10px] text-muted-foreground/60">
              Revenue = estimate value ex-GST
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              Cost = materials + labour + overhead
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              Other = freight · accommodation · travel · bailing
            </span>
          </div>
        )}

        {view === "actuals" && !hasActualsData && (
          <div className="px-3 py-4 border-t border-black/[0.05] dark:border-white/[0.05] text-center">
            <p className="text-xs text-muted-foreground">
              No actuals recorded for the selected projects yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "orange";
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-sm bg-card/65 backdrop-blur-xl px-3 py-2.5 space-y-0.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p
        className={
          highlight === "green"
            ? "text-lg font-semibold tabular-nums text-success"
            : highlight === "orange"
            ? "text-lg font-semibold tabular-nums text-warning"
            : "text-lg font-semibold tabular-nums text-foreground/75"
        }
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
