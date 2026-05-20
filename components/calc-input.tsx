"use client";

import { useState, useEffect, useRef } from "react";
import { parseCalc } from "@/lib/calc";

/**
 * A text input that accepts plain numbers or simple arithmetic expressions
 * (e.g. "10+5", "20*3.5", "100-20/2").  The expression is evaluated on blur
 * or Enter, and the result replaces the display value.
 *
 * Externally controlled via `value` (number).  Reports changes through
 * `onCommit` once the expression is resolved.
 */
export function CalcInput({
  value,
  onCommit,
  className,
  placeholder,
  onKeyDown,
  readOnly,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  const focused = useRef(false);

  // Sync display when the value is updated externally while not focused
  // (e.g. auto-consumable qty recalculation)
  useEffect(() => {
    if (!focused.current) {
      setDisplay(value === 0 ? "" : String(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    const result = parseCalc(raw) ?? (parseFloat(raw) || 0);
    const rounded = Math.round(result * 100) / 100;
    setDisplay(rounded === 0 ? "" : String(rounded));
    onCommit(rounded);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder ?? "0"}
      readOnly={readOnly}
      className={className}
      onChange={(e) => setDisplay(e.target.value)}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
          onKeyDown?.(e);
          return;
        }
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        commit(e.target.value);
      }}
    />
  );
}
