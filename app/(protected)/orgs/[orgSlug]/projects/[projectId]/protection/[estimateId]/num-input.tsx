"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Numeric input that keeps its own text while focused (so the cursor never jumps)
 * and reports a parsed number, or null when cleared. Shows `inherited` as a
 * placeholder when empty — clearing an override falls back to the job default.
 */
export function NumInput({
  value,
  onChange,
  inherited,
  integer,
  className = "",
  tone,
  title,
  ariaLabel,
  onPaste,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  inherited?: number | null;
  integer?: boolean;
  className?: string;
  /** "outline" = amber border only, no fill (used for install-rate mismatches) */
  tone?: "warn" | "outline" | "error";
  title?: string;
  ariaLabel: string;
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>;
}) {
  const [text, setText] = useState(value?.toString() ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value?.toString() ?? "");
  }, [value]);

  const overridden = inherited != null && value !== null;
  const usingDefault = inherited != null && value === null && text === "";
  const toneClass =
    tone === "error"
      ? "ring-1 ring-inset ring-destructive/60 bg-destructive/10"
      : tone === "warn"
      ? "ring-1 ring-inset ring-amber-500/60 bg-amber-500/10"
      : tone === "outline"
      ? "ring-1 ring-inset ring-amber-500/70"
      : "";

  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      onPaste={onPaste}
      title={
        title ??
        (overridden
          ? "Overrides the job default — clear to use the default"
          : usingDefault
          ? `Using the job default (${inherited}) — type a value to override`
          : undefined)
      }
      value={text}
      placeholder={inherited != null ? String(inherited) : ""}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value?.toString() ?? "");
      }}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.replace(/[$,\s]/g, "");
        if (t === "") return onChange(null);
        const n = Number(t);
        if (Number.isFinite(n) && n >= 0) onChange(integer ? Math.round(n) : n);
      }}
      className={`w-full bg-transparent px-2 py-1.5 text-right text-xs tabular-nums outline-none placeholder:text-sky-600/60 dark:placeholder:text-sky-400/60 focus:bg-primary/5 focus:ring-1 focus:ring-inset focus:ring-primary/50 ${
        overridden ? "text-primary" : "text-foreground/70"
      } ${toneClass} ${className}`}
    />
  );
}
