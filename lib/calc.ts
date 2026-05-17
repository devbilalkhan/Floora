/**
 * Evaluates a simple arithmetic expression string (+ - * / and parentheses).
 * Returns null if the expression is invalid or produces a negative/non-finite result.
 * Only allows digits, decimal points, and arithmetic operators — no eval of arbitrary code.
 */
export function parseCalc(expr: string): number | null {
  const s = expr.trim().replace(/\s+/g, "");
  if (!s) return null;
  if (!/^[\d.+\-*/()]+$/.test(s)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${s})`)() as unknown;
    if (typeof result === "number" && isFinite(result) && result >= 0) return result;
    return null;
  } catch {
    return null;
  }
}
