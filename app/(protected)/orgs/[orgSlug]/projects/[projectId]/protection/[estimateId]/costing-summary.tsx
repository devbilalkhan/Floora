"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { CostingInputs, CostingSummary, TradeSubtotal } from "@/lib/protection-summary";
import { NumInput } from "./num-input";

function money(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function pct(n: number, digits = 1) {
  return `${n.toLocaleString("en-AU", { maximumFractionDigits: digits })}%`;
}

const CARD = "bg-card/65 backdrop-blur-xl border border-border rounded-xl";
const CARD_TITLE = "text-[10px] uppercase tracking-wide text-muted-foreground font-medium";

// Composition bar colours — validated with the dataviz palette checker (CVD-safe adjacent
// pairs, ≥3:1 on both light and dark surfaces). Order is fixed: cost → admin → markup → pass-through.
const SEGMENTS = [
  { key: "cost", label: "Cost", color: "#7C3AED" },
  { key: "admin", label: "Admin", color: "#0891B2" },
  { key: "markup", label: "Markup", color: "#DB2777" },
  { key: "pass", label: "Pass-through", color: "#2563EB" },
  { key: "retention", label: "Retention", color: "#D97706" },
] as const;

function MoneyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-foreground/70">
        {label}
        {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <span className="relative w-32 shrink-0 rounded-md border border-black/10 dark:border-white/10 bg-background/40">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <NumInput ariaLabel={label} value={value} onChange={onChange} />
      </span>
    </label>
  );
}

/**
 * The big markup figure, typed into directly (decimals allowed, e.g. 23.5) — the slider
 * only does whole numbers. Keeps its own text while focused so the cursor never jumps;
 * clamped to 0–100 to match the markup_pct check constraint.
 */
function MarkupInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <span className="flex items-baseline rounded-md px-1 -mx-1 hover:bg-muted/30 focus-within:bg-muted/40 focus-within:ring-1 focus-within:ring-primary/50">
      <input
        inputMode="decimal"
        aria-label="Markup percentage"
        title="Type a markup %, or use the slider"
        value={text}
        size={Math.max(text.length, 1)}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(String(value));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(/[%\s]/g, ""));
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(Math.min(100, Math.max(0, n)));
        }}
        className="bg-transparent text-right text-3xl font-semibold tabular-nums text-primary outline-none"
      />
      <span className="text-3xl font-semibold text-primary">%</span>
    </span>
  );
}

// Faint repeat of the row label beside its value — on wide screens the label and the
// amount are far apart, so this lets the eye confirm which row it's reading.
function Caption({ children }: { children: React.ReactNode }) {
  return <span className="mr-2 text-[10px] font-normal lowercase text-muted-foreground/50">{children}</span>;
}

function Row({
  label,
  caption,
  value,
  op,
  strong,
  muted,
  indent,
}: {
  label: React.ReactNode;
  /** Text for the caption beside the value — defaults to the label */
  caption?: string;
  value: number;
  op?: "+" | "=";
  strong?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-t text-xs ${
        strong
          ? "border-black/10 dark:border-white/10 pt-2 pb-1 mt-1 font-semibold text-foreground"
          : "border-black/5 dark:border-white/5 py-1.5"
      } ${indent ? "pl-5" : ""}`}
    >
      <span className={`flex items-baseline gap-2 ${muted ? "text-muted-foreground" : strong ? "" : "text-foreground/70"}`}>
        <span className="w-3 text-center text-muted-foreground/60 font-mono">{op ?? ""}</span>
        {label}
      </span>
      <span className={`tabular-nums ${muted ? "text-muted-foreground" : strong ? "" : "text-foreground/70"}`}>
        <Caption>{caption ?? label}</Caption>
        {money(value)}
      </span>
    </div>
  );
}

/** The headline profit figure — gross profit margin on the ex-GST price, with the markup % and cash margin beneath. */
function GrossProfitBadge({
  marginPct,
  grossProfit,
  markupPct,
}: {
  marginPct: number;
  grossProfit: number;
  markupPct: number;
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 px-4 py-2.5 text-center shadow-[0_0_24px_-8px] shadow-primary/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Gross profit margin</p>
      <p className="text-3xl font-semibold leading-tight tracking-tight tabular-nums text-primary">
        {pct(marginPct * 100)}
      </p>
      <div className="mt-2 flex justify-center gap-5 border-t border-primary/25 pt-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Markup</p>
          <p className="text-base font-semibold tabular-nums text-primary">{pct(markupPct)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Cash margin</p>
          <p className="text-base font-semibold tabular-nums text-primary">{money(grossProfit)}</p>
        </div>
      </div>
    </div>
  );
}

export function CostingSummaryTab({
  summary: s,
  trades,
  inputs,
  onChange,
  onOpenTab,
  notes,
}: {
  summary: CostingSummary;
  trades: TradeSubtotal[];
  inputs: CostingInputs;
  onChange: <K extends keyof CostingInputs>(key: K, value: CostingInputs[K]) => void;
  onOpenTab: (key: string) => void;
  /** Notes panel, shown under the additional costs */
  notes: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const segments = [
    { ...SEGMENTS[0], value: s.costBase },
    { ...SEGMENTS[1], value: s.admin },
    { ...SEGMENTS[2], value: s.markup },
    { ...SEGMENTS[3], value: s.passThroughTotal },
    { ...SEGMENTS[4], value: s.retention },
  ];
  const shown = segments.filter((seg) => seg.value > 0);
  const share = (v: number) => (s.totalExGst > 0 ? (v / s.totalExGst) * 100 : 0);
  const active = segments.find((seg) => seg.key === hovered);
  const incompleteTrade = trades.find((t) => t.blockedLines > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Left: headline, trades, breakdown ───────────────────────────── */}
      <div className="space-y-4 lg:col-span-2">
        {/* Hero */}
        <section className={`${CARD} p-5 space-y-5`}>
          {incompleteTrade && (
            <button
              onClick={() => onOpenTab(incompleteTrade.key)}
              className="flex w-full items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                Totals are incomplete — {incompleteTrade.label} has {s.blockedLines}{" "}
                {s.blockedLines === 1 ? "line" : "lines"} missing an install rate.
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={CARD_TITLE}>Total ex GST</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{money(s.totalExGst)}</p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                {money(s.totalIncGst)} <span className="text-xs">inc GST</span>
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className={CARD_TITLE}>Cost</p>
                <p className="mt-1 text-base font-medium tabular-nums text-foreground/70">{money(s.costBase)}</p>
              </div>
              <GrossProfitBadge marginPct={s.marginPct} grossProfit={s.grossProfit} markupPct={inputs.markup_pct} />
            </div>
          </div>

          {/* Where the price goes */}
          {s.totalExGst > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className={CARD_TITLE}>Where the price goes</p>
                <p className="text-[11px] text-muted-foreground tabular-nums h-4">
                  {active ? `${active.label} · ${money(active.value)} · ${pct(share(active.value))}` : ""}
                </p>
              </div>
              <div className="flex h-3 w-full gap-[2px]" onMouseLeave={() => setHovered(null)}>
                {shown.map((seg, i) => (
                  <div
                    key={seg.key}
                    onMouseEnter={() => setHovered(seg.key)}
                    title={`${seg.label}: ${money(seg.value)} (${pct(share(seg.value))})`}
                    className={`h-full transition-opacity ${i === 0 ? "rounded-l" : ""} ${
                      i === shown.length - 1 ? "rounded-r" : ""
                    } ${hovered && hovered !== seg.key ? "opacity-40" : ""}`}
                    style={{ width: `${share(seg.value)}%`, backgroundColor: seg.color }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {segments.map((seg) => (
                  <div
                    key={seg.key}
                    onMouseEnter={() => setHovered(seg.key)}
                    onMouseLeave={() => setHovered(null)}
                    className="flex items-center gap-1.5 text-[11px]"
                  >
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: seg.color }} />
                    <span className="text-muted-foreground">{seg.label}</span>
                    <span className="tabular-nums text-foreground/70">{money(seg.value)}</span>
                    <span className="tabular-nums text-muted-foreground/70">{pct(share(seg.value), 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Trades */}
        <section className={`${CARD} overflow-hidden`}>
          <p className={`${CARD_TITLE} px-4 pt-3 pb-2`}>Trades</p>
          {trades.map((t) => (
            <button
              key={t.key}
              onClick={() => onOpenTab(t.key)}
              className="group flex w-full items-center gap-3 border-t border-black/5 dark:border-white/5 px-4 py-2 text-left hover:bg-muted/30"
            >
              <span className="flex-1 text-sm text-foreground/70 group-hover:text-foreground">{t.label}</span>
              {t.blockedLines > 0 ? (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive">
                  Incomplete
                </span>
              ) : t.subtotal === null ? (
                <span className="text-[11px] text-muted-foreground/50">Not started</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {t.lines} {t.lines === 1 ? "line" : "lines"}
                </span>
              )}
              <span className="w-28 text-right text-sm tabular-nums text-foreground/70">
                {t.subtotal === null ? "—" : money(t.subtotal)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60" />
            </button>
          ))}
          <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 bg-muted/30 px-4 py-2">
            <span className="text-xs font-medium">Trades subtotal</span>
            <span className="mr-[26px] text-sm font-semibold tabular-nums">{money(s.tradesSubtotal)}</span>
          </div>
        </section>

        {/* Breakdown */}
        <section className={`${CARD} p-4`}>
          <p className={`${CARD_TITLE} mb-2`}>Breakdown</p>
          <Row label="Trades subtotal" value={s.tradesSubtotal} />
          <Row label="Preliminaries" value={s.training} op="+" />
          <Row label="Cost base" value={s.costBase} op="=" strong />
          <Row label={`Admin (${pct(inputs.admin_pct, 2)})`} caption="Admin" value={s.admin} op="+" />
          <Row label={`Markup (${pct(inputs.markup_pct, 2)})`} caption="Markup" value={s.markup} op="+" />
          <Row label="Pass-through costs" value={s.passThroughTotal} op="+" />
          <Row label="Accommodation" value={s.passThrough.accommodation} muted indent />
          <Row label="Meals" value={s.passThrough.meals} muted indent />
          <Row label="Travel" value={s.passThrough.travel} muted indent />
          <Row label="Freight" value={s.passThrough.freight} muted indent />
          {inputs.retention_pct > 0 && (
            <>
              <Row label="Total before retention" value={s.beforeRetention} op="=" strong />
              <Row label={`Retention (${pct(inputs.retention_pct, 2)})`} caption="Retention" value={s.retention} op="+" />
            </>
          )}
          <Row label="Total ex GST" value={s.totalExGst} op="=" strong />
          <Row label="GST 10%" value={s.gst} op="+" />
          <div className="flex items-baseline justify-between gap-4 border-t border-black/10 dark:border-white/10 mt-1 pt-2">
            <span className="flex items-baseline gap-2 text-sm font-semibold">
              <span className="w-3 text-center text-muted-foreground/60 font-mono">=</span>
              Total inc GST
            </span>
            <span className="text-lg font-semibold tabular-nums">
              <Caption>Total inc GST</Caption>
              {money(s.totalIncGst)}
            </span>
          </div>
        </section>
      </div>

      {/* ── Right: pricing controls and extra costs ─────────────────────── */}
      <div className="space-y-4">
        <section className={`${CARD} p-4 space-y-4`}>
          <p className={CARD_TITLE}>Pricing</p>

          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-xs text-foreground/70">Markup on cost</span>
              <MarkupInput value={inputs.markup_pct} onChange={(v) => onChange("markup_pct", v)} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={inputs.markup_pct}
              onChange={(e) => onChange("markup_pct", Number(e.target.value))}
              aria-label="Markup percentage slider"
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
              {[0, 25, 50, 75, 100].map((n) => (
                <button key={n} onClick={() => onChange("markup_pct", n)} className="hover:text-foreground">
                  {n}%
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adds <span className="tabular-nums text-foreground/70">{money(s.markup)}</span> · gross profit margin{" "}
              <span className="tabular-nums text-foreground/70">{pct(s.marginPct * 100)}</span>
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 border-t border-black/10 dark:border-white/10 pt-3">
            <span className="text-xs text-foreground/70">
              Admin cost
              <span className="block text-[10px] text-muted-foreground">% of cost base</span>
            </span>
            <span className="relative w-24 rounded-md border border-black/10 dark:border-white/10 bg-background/40">
              <NumInput ariaLabel="Admin percentage" value={inputs.admin_pct} onChange={(v) => onChange("admin_pct", v ?? 0)} className="pr-6" />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-3 border-t border-black/10 dark:border-white/10 pt-3">
            <span className="text-xs text-foreground/70">
              Retention
              <span className="block text-[10px] text-muted-foreground">
                {inputs.retention_pct > 0 ? `Adds ${money(s.retention)} to the price` : "0% = no retention"}
              </span>
            </span>
            <span className="relative w-24 rounded-md border border-black/10 dark:border-white/10 bg-background/40">
              <NumInput
                ariaLabel="Retention percentage"
                value={inputs.retention_pct}
                onChange={(v) => onChange("retention_pct", Math.min(100, v ?? 0))}
                className="pr-6"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </span>
          </label>
        </section>

        <section className={`${CARD} p-4`}>
          <p className={CARD_TITLE}>Additional costs</p>
          <div className="mt-2">
            <MoneyField label="Preliminaries" hint="Marked up" value={inputs.training} onChange={(v) => onChange("training", v)} />
          </div>
          <div className="mt-3 border-t border-black/10 dark:border-white/10 pt-2">
            <p className="text-[10px] text-muted-foreground">Pass-through — no markup</p>
            <MoneyField label="Accommodation" value={inputs.accommodation} onChange={(v) => onChange("accommodation", v)} />
            <MoneyField label="Meals" value={inputs.meals} onChange={(v) => onChange("meals", v)} />
            <MoneyField label="Travel" value={inputs.travel} onChange={(v) => onChange("travel", v)} />
            <MoneyField label="Freight" value={inputs.freight} onChange={(v) => onChange("freight", v)} />
          </div>
        </section>

        {notes}
      </div>
    </div>
  );
}
