"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ActualsSection, type ActualGroup, type ActualLineItem } from "./actuals-section";
import { ActualsCharts } from "./actuals-charts";

function effectiveSub(item: ActualLineItem) {
  return item.qty !== null && item.unit_price !== null ? item.qty * item.unit_price : item.subtotal;
}

function fmtAU(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ActualsPageClient({
  projectId,
  orgId,
  incomeGroups,
  expenseGroups,
  allLineItems,
  retentionPct,
  initialAdminFeePct,
  initialAdminFeeEstimatedCost,
}: {
  projectId: string;
  orgId: string;
  incomeGroups: ActualGroup[];
  expenseGroups: ActualGroup[];
  allLineItems: ActualLineItem[];
  retentionPct: number | null;
  initialAdminFeePct: number | null;
  initialAdminFeeEstimatedCost: number | null;
}) {
  const incomeGroupIds = new Set(incomeGroups.map(g => g.id));
  const expenseGroupIds = new Set(expenseGroups.map(g => g.id));

  const [incomeTotal, setIncomeTotal] = useState(
    () => allLineItems.filter(i => incomeGroupIds.has(i.group_id)).reduce((s, i) => s + effectiveSub(i), 0)
  );
  const [expensesTotal, setExpensesTotal] = useState(
    () => allLineItems.filter(i => expenseGroupIds.has(i.group_id)).reduce((s, i) => s + effectiveSub(i), 0)
  );
  const [adminFeePct, setAdminFeePct] = useState<number | null>(initialAdminFeePct);
  const [adminFeeEstimatedCost, setAdminFeeEstimatedCost] = useState<number | null>(initialAdminFeeEstimatedCost);

  // Derived P&L
  const adminFeeBase = adminFeeEstimatedCost ?? expensesTotal;
  const adminFeeAmount =
    adminFeePct != null && adminFeePct > 0
      ? Math.round(adminFeeBase * (adminFeePct / 100) * 100) / 100
      : null;
  const totalCost = expensesTotal + (adminFeeAmount ?? 0);
  const grossProfit = incomeTotal - totalCost;
  const gpPct = incomeTotal > 0 ? (grossProfit / incomeTotal) * 100 : null;
  const retentionHeld =
    retentionPct && retentionPct > 0 ? incomeTotal * (retentionPct / 100) : 0;

  // Expense group breakdown for charts (initial — proportions from loaded data)
  const expenseGroupTotals = expenseGroups
    .map(g => ({
      name: g.name,
      value: allLineItems.filter(i => i.group_id === g.id).reduce((s, i) => s + effectiveSub(i), 0),
    }))
    .filter(g => g.value > 0)
    .sort((a, b) => b.value - a.value);

  const handleAdminFeeChange = useCallback((pct: number | null, cost: number | null) => {
    setAdminFeePct(pct);
    setAdminFeeEstimatedCost(cost);
  }, []);

  return (
    <>
      {/* P&L Summary Cards */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[130px] rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Total Income</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtAU(incomeTotal)}</p>
        </div>
        <div className="flex-1 min-w-[130px] rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Total Expenses</p>
          <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{fmtAU(expensesTotal)}</p>
        </div>
        {adminFeeAmount != null && (
          <div className="flex-1 min-w-[130px] rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Admin &amp; Other Fee</p>
            <p className="text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">{fmtAU(adminFeeAmount)}</p>
            <p className="text-[10px] text-orange-600/60 dark:text-orange-400/60 tabular-nums mt-0.5">{adminFeePct}%</p>
          </div>
        )}
        {adminFeeAmount != null && (
          <div className="flex-1 min-w-[130px] rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Total Cost</p>
            <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{fmtAU(totalCost)}</p>
          </div>
        )}
        <div className={cn(
          "flex-1 min-w-[130px] rounded-md border px-3 py-2.5",
          grossProfit >= 0 ? "border-blue-500/30 bg-blue-500/10" : "border-red-500/30 bg-red-500/10"
        )}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Gross Profit</p>
          <p className={cn(
            "text-sm font-semibold tabular-nums",
            grossProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
          )}>{fmtAU(grossProfit)}</p>
        </div>
        {gpPct != null && (
          <div className={cn(
            "flex-1 min-w-[130px] rounded-md border px-3 py-2.5",
            gpPct >= 0 ? "border-blue-500/30 bg-blue-500/10" : "border-red-500/30 bg-red-500/10"
          )}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">GP%</p>
            <p className={cn(
              "text-sm font-semibold tabular-nums",
              gpPct >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
            )}>{gpPct.toFixed(1)}%</p>
          </div>
        )}
        {retentionHeld > 0 && (
          <div className="flex-1 min-w-[130px] rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Retention Held</p>
            <p className="text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">{fmtAU(retentionHeld)}</p>
            <p className="text-[10px] text-orange-600/60 dark:text-orange-400/60 tabular-nums mt-0.5">{retentionPct}%</p>
          </div>
        )}
      </div>

      {(incomeTotal > 0 || expensesTotal > 0) && (
        <ActualsCharts
          totalIncome={incomeTotal}
          totalCost={totalCost}
          grossProfit={grossProfit}
          expenseGroupTotals={expenseGroupTotals}
        />
      )}

      <ActualsSection
        type="income"
        projectId={projectId}
        orgId={orgId}
        initialGroups={incomeGroups}
        initialLineItems={allLineItems}
        retentionPct={retentionPct}
        onTotalsChange={setIncomeTotal}
      />

      <ActualsSection
        type="expense"
        projectId={projectId}
        orgId={orgId}
        initialGroups={expenseGroups}
        initialLineItems={allLineItems}
        retentionPct={null}
        adminFeePct={adminFeePct}
        adminFeeEstimatedCost={adminFeeEstimatedCost}
        onTotalsChange={setExpensesTotal}
        onAdminFeeChange={handleAdminFeeChange}
      />
    </>
  );
}
