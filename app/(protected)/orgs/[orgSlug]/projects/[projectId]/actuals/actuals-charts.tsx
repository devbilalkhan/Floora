"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

type GroupTotal = { name: string; value: number };

interface Props {
  totalIncome: number;
  totalCost: number;
  grossProfit: number;
  expenseGroupTotals: GroupTotal[];
}

function fmtAU(n: number) {
  return "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-0.5">{label}</p>
      <p className="font-mono tabular-nums text-foreground">
        {payload[0].value < 0 ? "-" : ""}{fmtAU(payload[0].value)}
      </p>
    </div>
  );
}

function GroupTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-0.5">{payload[0].payload.name}</p>
      <p className="font-mono tabular-nums text-foreground">{fmtAU(payload[0].value)}</p>
    </div>
  );
}

export function ActualsCharts({ totalIncome, totalCost, grossProfit, expenseGroupTotals }: Props) {
  const plData = [
    { name: "Income", value: totalIncome, color: "rgb(52 211 153 / 0.85)" },
    { name: "Cost", value: totalCost, color: "rgb(248 113 113 / 0.85)" },
    { name: "GP", value: grossProfit, color: grossProfit >= 0 ? "rgb(96 165 250 / 0.85)" : "rgb(248 113 113 / 0.85)" },
  ];

  // Cap at 7 groups so bars stay readable at fixed height
  const groups = expenseGroupTotals.slice(0, 7);
  const hasGroups = groups.length > 0;
  const groupChartHeight = Math.max(120, groups.length * 32 + 16);

  return (
    <div className={`grid gap-3 ${hasGroups ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
      {/* P&L Overview */}
      <div className="rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">P&amp;L Overview</p>
        <ChartContainer config={{}} className="h-[160px]">
          <BarChart data={plData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <ChartTooltip content={<SimpleTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {plData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      {/* Expenses by Group */}
      {hasGroups && (
        <div className="rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">Expenses by Group</p>
          <ChartContainer config={{}} style={{ height: groupChartHeight }} className="w-full">
            <BarChart data={groups} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                width={90}
                tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
              />
              <ChartTooltip content={<GroupTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary) / 0.7)" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
