"use client";

import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartProject = {
  name: string;
  estimate?: number;          // undefined → bar hidden (actuals view)
  actualIncome?: number;
  actualCost?: number;
  estGpPct?: number;          // undefined → bar hidden (actuals view)
  actGpPct?: number | null;
};

export type TimelinePoint = {
  ym: string;
  income: number;
  cost: number;
};

function fmtK(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1000) return sign + "$" + (abs / 1000).toFixed(0) + "k";
  return sign + "$" + abs.toFixed(0);
}

function truncate(s: string, max = 13) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const label = new Date(+y, +m - 1, 1).toLocaleDateString("en-AU", { month: "short" });
  return `${label} '${y.slice(2)}`;
}

const TOOLTIP_STYLE = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  padding: "6px 10px",
};

function RevenueChart({ projects }: { projects: ChartProject[] }) {
  const showEstimate = projects.some((p) => p.estimate !== undefined);
  const showIncome = projects.some((p) => (p.actualIncome ?? 0) > 0);
  const showCost = projects.some((p) => (p.actualCost ?? 0) > 0);

  const data = projects.map((p) => ({
    name: truncate(p.name),
    ...(showEstimate ? { Estimate: p.estimate } : {}),
    ...(showIncome ? { "Act. Income": (p.actualIncome ?? 0) > 0 ? p.actualIncome : undefined } : {}),
    ...(showCost ? { "Act. Cost": (p.actualCost ?? 0) > 0 ? p.actualCost : undefined } : {}),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }} barCategoryGap="22%" barGap={3}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
        <YAxis hide />
        <Tooltip
          formatter={(v: number, name: string) => [fmtK(v), name]}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        {showEstimate && (
          <Bar dataKey="Estimate" fill="hsl(var(--primary) / 0.6)" radius={[3, 3, 0, 0]} maxBarSize={34} />
        )}
        {showIncome && (
          <Bar dataKey="Act. Income" fill="rgb(52 211 153 / 0.75)" radius={[3, 3, 0, 0]} maxBarSize={34} />
        )}
        {showCost && (
          <Bar dataKey="Act. Cost" fill="rgb(251 146 60 / 0.75)" radius={[3, 3, 0, 0]} maxBarSize={34} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function GpPctChart({ projects }: { projects: ChartProject[] }) {
  const showEst = projects.some((p) => p.estGpPct !== undefined);
  const showAct = projects.some((p) => p.actGpPct != null);

  const data = projects.map((p) => ({
    name: truncate(p.name),
    ...(showEst && p.estGpPct !== undefined
      ? { "Est. GP%": parseFloat(p.estGpPct.toFixed(1)) }
      : {}),
    ...(showAct && p.actGpPct != null
      ? { "Act. GP%": parseFloat(p.actGpPct.toFixed(1)) }
      : {}),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
        barGap={3}
        barCategoryGap="28%"
      >
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 9 }}
          tickFormatter={(v) => `${v}%`}
          domain={[0, "dataMax + 4"]}
        />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10 }}
          width={82}
        />
        <Tooltip
          formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        {showEst && (
          <Bar dataKey="Est. GP%" fill="hsl(var(--primary) / 0.6)" radius={[0, 3, 3, 0]} maxBarSize={14} />
        )}
        {showAct && (
          <Bar dataKey="Act. GP%" fill="rgb(52 211 153 / 0.75)" radius={[0, 3, 3, 0]} maxBarSize={14} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimelineChart({ timeline }: { timeline: TimelinePoint[] }) {
  let cumIncome = 0;
  let cumCost = 0;
  const series = timeline.map((p) => {
    cumIncome += p.income;
    cumCost += p.cost;
    return { month: fmtMonth(p.ym), income: cumIncome, cost: cumCost };
  });

  if (series.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground/45">No dated actuals yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="gradIncCons" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="rgb(52 211 153)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="rgb(52 211 153)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradCostCons" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="rgb(251 146 60)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="rgb(251 146 60)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis hide />
        <Tooltip formatter={(v: number, name: string) => [fmtK(v), name]} contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="income" name="Income" stroke="rgb(52 211 153)" strokeWidth={1.5} fill="url(#gradIncCons)" dot={false} />
        <Area type="monotone" dataKey="cost" name="Cost" stroke="rgb(251 146 60)" strokeWidth={1.5} fill="url(#gradCostCons)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ReportCharts({
  projects,
  timeline,
}: {
  projects: ChartProject[];
  timeline: TimelinePoint[];
}) {
  const showEstimate = projects.some((p) => p.estimate !== undefined);
  const showActuals = projects.some((p) => (p.actualIncome ?? 0) > 0 || (p.actualCost ?? 0) > 0);
  const showEstGp = projects.some((p) => p.estGpPct !== undefined);
  const showActGp = projects.some((p) => p.actGpPct != null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="border border-black/10 dark:border-white/10 rounded-sm bg-card/65 backdrop-blur-xl px-4 py-3">
        <p className="text-xs font-medium text-foreground/70 mb-0.5">
          {showEstimate ? "Revenue & Actuals" : "Income & Expenses"}
        </p>
        <p className="text-[10px] text-muted-foreground mb-3">
          {showEstimate
            ? "Estimate vs actual income & cost per project"
            : "Actual income & expenses per project"}
        </p>
        <div className="h-[180px]">
          <RevenueChart projects={projects} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          {showEstimate && <Swatch color="hsl(var(--primary) / 0.6)" label="Estimate" />}
          {showActuals && <Swatch color="rgb(52 211 153 / 0.75)" label="Act. Income" />}
          {showActuals && <Swatch color="rgb(251 146 60 / 0.75)" label="Act. Cost" />}
        </div>
      </div>

      <div className="border border-black/10 dark:border-white/10 rounded-sm bg-card/65 backdrop-blur-xl px-4 py-3">
        <p className="text-xs font-medium text-foreground/70 mb-0.5">Margin % by Project</p>
        <p className="text-[10px] text-muted-foreground mb-3">
          {showEstGp && showActGp
            ? "Estimated vs actual gross margin"
            : showEstGp
            ? "Estimated gross margin per project"
            : "Actual gross margin per project"}
        </p>
        <div className="h-[180px]">
          <GpPctChart projects={projects} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          {showEstGp && <Swatch color="hsl(var(--primary) / 0.6)" label="Est. Margin%" />}
          {showActGp && <Swatch color="rgb(52 211 153 / 0.75)" label="Act. Margin%" />}
        </div>
      </div>

      <div className="border border-black/10 dark:border-white/10 rounded-sm bg-card/65 backdrop-blur-xl px-4 py-3">
        <p className="text-xs font-medium text-foreground/70 mb-0.5">Actuals Timeline</p>
        <p className="text-[10px] text-muted-foreground mb-3">
          Cumulative income &amp; cost across all selected projects
        </p>
        <div className="h-[180px]">
          <TimelineChart timeline={timeline} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Swatch color="rgb(52 211 153)" label="Income" />
          <Swatch color="rgb(251 146 60)" label="Cost" />
        </div>
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
