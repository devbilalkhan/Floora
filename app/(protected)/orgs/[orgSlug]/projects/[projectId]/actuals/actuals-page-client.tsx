"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ActualsSection, type ActualGroup, type ActualLineItem } from "./actuals-section";
import { ActualsCharts } from "./actuals-charts";
import { updateProjectRetentionPct } from "./actions";

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
    () => allLineItems.filter(i => incomeGroupIds.has(i.group_id) && i.included_in_totals).reduce((s, i) => s + effectiveSub(i), 0)
  );
  const [expensesTotal, setExpensesTotal] = useState(
    () => allLineItems.filter(i => expenseGroupIds.has(i.group_id) && i.included_in_totals).reduce((s, i) => s + effectiveSub(i), 0)
  );
  const [adminFeePct, setAdminFeePct] = useState<number | null>(initialAdminFeePct);
  const [adminFeeEstimatedCost, setAdminFeeEstimatedCost] = useState<number | null>(initialAdminFeeEstimatedCost);

  // Retention — global % (editable here) applied only to income lines flagged for retention
  const [retentionPctVal, setRetentionPctVal] = useState<number | null>(retentionPct);
  const [rawRetentionPct, setRawRetentionPct] = useState(retentionPct !== null ? String(retentionPct) : "");
  const [savingRetentionPct, setSavingRetentionPct] = useState(false);
  const [retentionBase, setRetentionBase] = useState(
    () =>
      allLineItems
        .filter(i => incomeGroupIds.has(i.group_id) && i.retention_applied && i.included_in_totals)
        .reduce((s, i) => s + effectiveSub(i), 0)
  );

  // Freight — sum of any line (income or expense) tagged with the FR code
  const [incomeFreight, setIncomeFreight] = useState(
    () =>
      allLineItems
        .filter(i => incomeGroupIds.has(i.group_id) && i.code === "FR" && i.included_in_totals)
        .reduce((s, i) => s + effectiveSub(i), 0)
  );
  const [expenseFreight, setExpenseFreight] = useState(
    () =>
      allLineItems
        .filter(i => expenseGroupIds.has(i.group_id) && i.code === "FR" && i.included_in_totals)
        .reduce((s, i) => s + effectiveSub(i), 0)
  );
  const freightTotal = incomeFreight + expenseFreight;

  async function saveRetentionPct() {
    const trimmed = rawRetentionPct.trim();
    const val = trimmed === "" ? null : parseFloat(trimmed);
    const resolved = val === null || isNaN(val) ? null : val;
    setSavingRetentionPct(true);
    try {
      await updateProjectRetentionPct(projectId, resolved);
      setRetentionPctVal(resolved);
    } catch {
      toast.error("Failed to save retention %.");
      setRawRetentionPct(retentionPctVal !== null ? String(retentionPctVal) : "");
    } finally {
      setSavingRetentionPct(false);
    }
  }

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
    retentionPctVal && retentionPctVal > 0 ? retentionBase * (retentionPctVal / 100) : 0;

  // Expense group breakdown for charts (initial — proportions from loaded data)
  const expenseGroupTotals = expenseGroups
    .map(g => ({
      name: g.name,
      value: allLineItems.filter(i => i.group_id === g.id && i.included_in_totals).reduce((s, i) => s + effectiveSub(i), 0),
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
        <div className="flex-1 min-w-[150px] rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Retention Held</p>
          <p className="text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">{fmtAU(retentionHeld)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="text"
              inputMode="decimal"
              value={rawRetentionPct}
              onChange={e => setRawRetentionPct(e.target.value)}
              onBlur={saveRetentionPct}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="0"
              className="w-9 bg-transparent border-b border-orange-500/30 text-[10px] text-orange-600 dark:text-orange-400 tabular-nums text-right focus:outline-none focus:border-orange-500"
            />
            <span className="text-[10px] text-orange-600/60 dark:text-orange-400/60">% retention{savingRetentionPct ? "…" : ""}</span>
          </div>
        </div>
        {freightTotal > 0 && (
          <div className="flex-1 min-w-[130px] rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">Total Freight</p>
            <p className="text-sm font-semibold tabular-nums text-sky-600 dark:text-sky-400">{fmtAU(freightTotal)}</p>
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
        retentionPct={retentionPctVal}
        onTotalsChange={setIncomeTotal}
        onRetentionBaseChange={setRetentionBase}
        onFreightTotalChange={setIncomeFreight}
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
        onFreightTotalChange={setExpenseFreight}
      />
    </>
  );
}
