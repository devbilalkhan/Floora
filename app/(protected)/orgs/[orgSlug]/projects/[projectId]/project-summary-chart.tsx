"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ActualItem {
  invoice_date: string | null;
  subtotal: number;
  qty: number | null;
  unit_price: number | null;
  type: "income" | "expense";
}

interface Props {
  estimateLabel: string;
  estimateValue: number;
  actualsItems: ActualItem[];
  href: string;
}

function effSub(item: ActualItem) {
  return item.qty != null && item.unit_price != null ? item.qty * item.unit_price : item.subtotal;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const label = new Date(+y, +m - 1, 1).toLocaleDateString("en-AU", { month: "short" });
  return `${label} '${y.slice(2)}`;
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}

function buildSeries(items: ActualItem[]) {
  const byMonth = new Map<string, { income: number; cost: number }>();

  for (const item of items) {
    if (!item.invoice_date) continue;
    const ym = item.invoice_date.slice(0, 7);
    const entry = byMonth.get(ym) ?? { income: 0, cost: 0 };
    const val = effSub(item);
    if (item.type === "income") entry.income += val;
    else entry.cost += val;
    byMonth.set(ym, entry);
  }

  const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

  let cumIncome = 0, cumCost = 0;
  return sorted.map(([ym, vals]) => {
    cumIncome += vals.income;
    cumCost += vals.cost;
    return { month: fmtMonth(ym), income: cumIncome, cost: cumCost };
  });
}

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl space-y-0.5">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {fmtK(p.value)}
        </p>
      ))}
    </div>
  );
}

export function ProjectSummaryChart({ estimateLabel, estimateValue, actualsItems, href }: Props) {
  const series = buildSeries(actualsItems);

  const totalIncome = actualsItems.filter(i => i.type === "income").reduce((s, i) => s + effSub(i), 0);
  const totalCost = actualsItems.filter(i => i.type === "expense").reduce((s, i) => s + effSub(i), 0);
  const gp = totalIncome - totalCost;
  const gpPct = totalIncome > 0 ? (gp / totalIncome) * 100 : null;

  const hasData = series.length > 0;

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          vs <span className="text-foreground/70">{estimateLabel}</span>
          {gpPct != null && (
            <span className={`ml-2 font-medium tabular-nums ${gpPct >= 0 ? "text-emerald-400" : "text-orange-400"}`}>
              GP {gpPct.toFixed(1)}%
            </span>
          )}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
      </div>

      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={hasData ? series : [{ month: "Now", income: 0, cost: 0 }]}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(52 211 153)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(52 211 153)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(251 146 60)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="rgb(251 146 60)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9 }}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={[0, (max: number) => Math.max(max, estimateValue * 1.05)]} />
            <Tooltip content={<AreaTooltip />} />
            <ReferenceLine
              y={estimateValue}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: fmtK(estimateValue), position: "insideTopRight", fontSize: 9, fill: "hsl(var(--primary) / 0.7)" }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="rgb(52 211 153)"
              strokeWidth={1.5}
              fill="url(#gradIncome)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="cost"
              name="Cost"
              stroke="rgb(251 146 60)"
              strokeWidth={1.5}
              fill="url(#gradCost)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {!hasData && (
        <p className="text-center text-[10px] text-muted-foreground/50 -mt-1">No dated actuals yet</p>
      )}
    </Link>
  );
}
