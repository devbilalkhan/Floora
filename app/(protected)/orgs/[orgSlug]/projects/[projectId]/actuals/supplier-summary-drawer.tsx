"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type ActualGroup,
  type ActualLineItem,
  buildSupplierColorMap,
  effectiveSubtotal,
  fmt,
  supplierBadgeClass,
} from "./actuals-section";

type SupplierTotal = {
  key: string;
  name: string;
  total: number;
  count: number;
  badgeClass: string;
};

function buildSupplierTotals(
  lineItems: ActualLineItem[],
  expenseGroupIds: Set<string>,
  colorMap: Map<string, string>
): SupplierTotal[] {
  const byKey = new Map<string, SupplierTotal>();

  for (const item of lineItems) {
    if (!expenseGroupIds.has(item.group_id) || !item.included_in_totals) continue;

    const trimmed = item.supplier?.trim() || "";
    const key = trimmed.toLowerCase() || "__none__";
    const amount = effectiveSubtotal(item);
    const existing = byKey.get(key);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      byKey.set(key, {
        key,
        name: trimmed || "No supplier",
        total: amount,
        count: 1,
        badgeClass: trimmed ? supplierBadgeClass(colorMap, trimmed) : "bg-muted",
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.total - a.total);
}

function SupplierSummarySheet({
  open,
  onClose,
  expenseGroups,
  allLineItems,
}: {
  open: boolean;
  onClose: () => void;
  expenseGroups: ActualGroup[];
  allLineItems: ActualLineItem[];
}) {
  const [search, setSearch] = useState("");

  const expenseGroupIds = useMemo(
    () => new Set(expenseGroups.map((g) => g.id)),
    [expenseGroups]
  );
  const colorMap = useMemo(() => buildSupplierColorMap(allLineItems), [allLineItems]);
  const totals = useMemo(
    () => buildSupplierTotals(allLineItems, expenseGroupIds, colorMap),
    [allLineItems, expenseGroupIds, colorMap]
  );

  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  const maxTotal = totals.length ? totals[0].total : 0;

  const filtered = search
    ? totals.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : totals;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] flex flex-col gap-0 p-0 bg-card border-l border-border"
      >
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-semibold text-foreground/75">
            Supplier Summary
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Expense totals by supplier / labour company for this project.
          </p>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-input border border-border rounded-md text-foreground/70 placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* Supplier rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-[11px] text-muted-foreground">
              {totals.length === 0 ? "No expense line items yet." : "No suppliers match your search."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const widthPct = maxTotal > 0 ? Math.max((t.total / maxTotal) * 100, 3) : 0;
                const sharePct = grandTotal > 0 ? (t.total / grandTotal) * 100 : 0;
                return (
                  <li key={t.key} className="relative px-4 py-2.5 overflow-hidden">
                    <div
                      className={cn("absolute inset-y-0 left-0 rounded-r-sm", t.badgeClass)}
                      style={{ width: `${widthPct}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-[11px] font-medium truncate",
                            t.name === "No supplier"
                              ? "italic text-muted-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {t.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {t.count} {t.count === 1 ? "line" : "lines"} · {sharePct.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-[11px] font-medium tabular-nums text-foreground/80 shrink-0">
                        {fmt(t.total)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer total */}
        <div className="px-4 py-2.5 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/45">
            {filtered.length} of {totals.length} suppliers
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-foreground/75">
            Total: {fmt(grandTotal)}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SupplierSummaryButton({
  expenseGroups,
  allLineItems,
}: {
  expenseGroups: ActualGroup[];
  allLineItems: ActualLineItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Building2 className="h-3.5 w-3.5" />
        Supplier Summary
      </button>
      <SupplierSummarySheet
        open={open}
        onClose={() => setOpen(false)}
        expenseGroups={expenseGroups}
        allLineItems={allLineItems}
      />
    </>
  );
}
