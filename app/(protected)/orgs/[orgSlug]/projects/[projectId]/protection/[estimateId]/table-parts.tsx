"use client";

import { AlertTriangle, XCircle } from "lucide-react";

// Shared pieces of the protection estimate line tables (corner guards, wall panels).

export function money(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function TextInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  onPaste,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  ariaLabel: string;
  placeholder?: string;
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      aria-label={ariaLabel}
      onPaste={onPaste}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className="w-full bg-transparent px-2 py-1.5 text-xs text-foreground/70 outline-none placeholder:text-muted-foreground/50 focus:bg-primary/5 focus:ring-1 focus:ring-inset focus:ring-primary/50"
    />
  );
}

export function IssueIcon({ issues }: { issues: { level: string; message: string }[] }) {
  if (issues.length === 0) return null;
  const severe = issues.some((i) => i.level === "block" || i.level === "error");
  const Icon = severe ? XCircle : AlertTriangle;
  return (
    <span title={issues.map((i) => `• ${i.message}`).join("\n")} className="inline-flex">
      <Icon className={`h-3.5 w-3.5 ${severe ? "text-destructive" : "text-amber-500"}`} />
    </span>
  );
}

export function DefaultField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      <div className="w-28 rounded-sm border border-black/10 dark:border-white/10 bg-background/40">{children}</div>
    </label>
  );
}

export const TH = "px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b border-r border-black/10 dark:border-white/10 whitespace-nowrap";
export const TD = "border-r border-black/10 dark:border-white/10 p-0";
export const CALC = "px-2 py-1.5 text-right text-xs tabular-nums text-foreground/70 bg-muted/20 whitespace-nowrap";
