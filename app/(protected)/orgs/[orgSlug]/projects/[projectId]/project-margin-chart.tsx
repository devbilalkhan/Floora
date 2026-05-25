"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  estimateGpPct: number;   // decimal e.g. 0.25
  estimateGp: number;
  estimateValue: number;
  actualGpPct: number | null;
  actualGp: number;
  actualIncome: number;
  href: string;
}

function fmtK(n: number | undefined) {
  if (n === undefined || isNaN(n)) return "";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1000) return sign + "$" + (abs / 1000).toFixed(1) + "k";
  return sign + "$" + abs.toFixed(0);
}

function fmtAU(n: number) {
  return "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Suppress bars with no data (height <= 1 or NaN)
function SafeBar(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 1 || isNaN(height)) return <g />;
  return <rect x={x} y={y} width={Math.max(0, width)} height={height} fill={fill} rx={3} />;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const valid = payload.filter((p: any) => p.value != null && !isNaN(p.value) && p.value > 0);
  if (!valid.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl space-y-0.5">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {valid.map((p: any) => {
        const isPct = p.dataKey === "estM" || p.dataKey === "actM";
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ background: p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-mono tabular-nums text-foreground">
              {isPct ? `${p.value.toFixed(1)}%` : fmtAU(p.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectMarginChart({
  estimateGpPct, estimateGp, estimateValue,
  actualGpPct, actualGp, actualIncome,
  href,
}: Props) {
  const estPctNum = estimateGpPct * 100;
  const estPct = estPctNum.toFixed(1);
  const actPositive = actualGpPct == null || actualGpPct >= 0;
  const actColor = actPositive ? "rgb(52 211 153 / 0.85)" : "rgb(251 146 60 / 0.85)";
  const pctMax = Math.max(50, estPctNum * 1.3, Math.abs(actualGpPct ?? 0) * 1.3);

  const data = [
    { category: "Income",   est: estimateValue, act: actualIncome, estM: undefined, actM: undefined },
    { category: "GP",       est: estimateGp,    act: actualGp,     estM: undefined, actM: undefined },
    { category: "Margin %", est: undefined,     act: undefined,    estM: estPctNum, actM: actualGpPct ?? 0 },
  ];

  // Labels for dollar bars — GP row shows % only (no dollar); other rows show dollar value
  const EstDollarLabel = ({ x, y, width, value, index }: any) => {
    if (!value || isNaN(value)) return <g />;
    if (index === 1) {
      return <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--primary) / 0.85)">{estPct}%</text>;
    }
    return <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.85)">{fmtK(value)}</text>;
  };

  const ActDollarLabel = ({ x, y, width, value, index }: any) => {
    if (!value || isNaN(value)) return <g />;
    if (index === 1) {
      if (actualGpPct == null) return <g />;
      return <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill={actColor.replace("0.85", "0.9")}>{actualGpPct.toFixed(1)}%</text>;
    }
    return <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.85)">{fmtK(value)}</text>;
  };

  // Labels for margin % bars — show dollar value above, percentage below with spacing
  const EstPctLabel = ({ x, y, width, value }: any) => {
    if (!value || isNaN(value)) return <g />;
    return (
      <g>
        <text x={x + width / 2} y={y - 15} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.85)">{fmtK(estimateGp)}</text>
        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="hsl(var(--primary) / 0.85)">{value.toFixed(1)}%</text>
      </g>
    );
  };

  const ActPctLabel = ({ x, y, width, value }: any) => {
    if (value == null || isNaN(value) || actualGpPct == null) return <g />;
    return (
      <g>
        <text x={x + width / 2} y={y - 15} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.85)">{fmtK(actualGp)}</text>
        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill={actColor.replace("0.85", "0.9")}>{value.toFixed(1)}%</text>
      </g>
    );
  };

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-card/65 backdrop-blur-xl px-4 py-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/65" />
            Est. GP {estPct}%
          </div>
          {actualGpPct != null && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: actColor }} />
              Act. GP {actualGpPct.toFixed(1)}%
            </div>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
      </div>

      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 26, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%" barGap={3}>
            <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="d" hide />
            <YAxis yAxisId="p" hide domain={[0, pctMax]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />

            {/* Dollar bars */}
            <Bar yAxisId="d" dataKey="est" name="Estimate" fill="hsl(var(--primary) / 0.65)" shape={<SafeBar />} radius={[3,3,0,0]} maxBarSize={38}>
              <LabelList content={EstDollarLabel} />
            </Bar>
            <Bar yAxisId="d" dataKey="act" name="Actual" shape={<SafeBar />} radius={[3,3,0,0]} maxBarSize={38}>
              {data.map((_, i) => <Cell key={i} fill={actColor} />)}
              <LabelList content={ActDollarLabel} />
            </Bar>

            {/* Margin % bars */}
            <Bar yAxisId="p" dataKey="estM" name="Est. Margin" fill="hsl(var(--primary) / 0.45)" shape={<SafeBar />} radius={[3,3,0,0]} maxBarSize={38}>
              <LabelList content={EstPctLabel} />
            </Bar>
            <Bar yAxisId="p" dataKey="actM" name="Act. Margin" shape={<SafeBar />} radius={[3,3,0,0]} maxBarSize={38}>
              {data.map((_, i) => <Cell key={i} fill={actColor.replace("0.85", "0.55")} />)}
              <LabelList content={ActPctLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Link>
  );
}
