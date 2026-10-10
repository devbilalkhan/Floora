import { parseCellNumber } from "@/lib/trade-sheet-types";
import type { TradeSheetColumn, TradeSheetRow } from "@/lib/trade-sheet-types";

// Column formulas, e.g. "[Qty] * [Rate]". Stored with column ids — "{<id>} * {<id>}" —
// so renaming a column never breaks a formula. Shown to users with [Name] references.
// Grammar: expr = term (("+"|"-") term)* · term = factor (("*"|"/") factor)*
//          factor = "-" factor | "(" expr ")" | number | {columnId}

export class FormulaError extends Error {}

/** Evaluates a stored formula. `resolve` returns a referenced column's value for the current row. */
export function evaluateFormula(formula: string, resolve: (colId: string) => number): number {
  let pos = 0;

  function skipSpace() {
    while (formula[pos] === " ") pos++;
  }

  function expr(): number {
    let value = term();
    for (skipSpace(); formula[pos] === "+" || formula[pos] === "-"; skipSpace()) {
      const op = formula[pos++];
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function term(): number {
    let value = factor();
    for (skipSpace(); formula[pos] === "*" || formula[pos] === "/"; skipSpace()) {
      const op = formula[pos++];
      const rhs = factor();
      if (op === "/" && rhs === 0) throw new FormulaError("#DIV/0!");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function factor(): number {
    skipSpace();
    const ch = formula[pos];
    if (ch === "-") {
      pos++;
      return -factor();
    }
    if (ch === "(") {
      pos++;
      const value = expr();
      skipSpace();
      if (formula[pos++] !== ")") throw new FormulaError("Missing closing bracket");
      return value;
    }
    if (ch === "{") {
      const end = formula.indexOf("}", pos);
      if (end === -1) throw new FormulaError("Invalid column reference");
      const id = formula.slice(pos + 1, end);
      pos = end + 1;
      return resolve(id);
    }
    const match = /^\d*\.?\d+/.exec(formula.slice(pos));
    if (!match) throw new FormulaError(ch ? `Unexpected "${ch}"` : "Formula is incomplete");
    pos += match[0].length;
    return Number(match[0]);
  }

  const value = expr();
  skipSpace();
  if (pos < formula.length) throw new FormulaError(`Unexpected "${formula[pos]}"`);
  return value;
}

/** Stored form → what the user sees: {id} becomes [Column name]. */
export function formulaToDisplay(formula: string, columns: TradeSheetColumn[]): string {
  return formula.replace(/\{([^}]+)\}/g, (_, id) => {
    const col = columns.find((c) => c.id === id);
    return col ? `[${col.name}]` : "[deleted column]";
  });
}

/** What the user typed → stored form. Throws FormulaError with a readable message when invalid. */
export function formulaFromDisplay(text: string, columns: TradeSheetColumn[], selfId: string): string {
  const stored = text.replace(/\[([^\]]*)\]/g, (_, rawName: string) => {
    const name = rawName.trim().toLowerCase();
    const matches = columns.filter((c) => c.name.trim().toLowerCase() === name);
    if (matches.length === 0) throw new FormulaError(`No column named "${rawName}"`);
    if (matches.length > 1) throw new FormulaError(`Two columns are named "${rawName}" — rename one first`);
    if (matches[0].id === selfId) throw new FormulaError("A column can't reference itself");
    return `{${matches[0].id}}`;
  });
  if (!stored.trim()) throw new FormulaError("Enter a formula");
  evaluateFormula(stored, () => 1); // syntax check
  return stored;
}

/** A cell's numeric value, computing formula columns. Returns an error code string (e.g. "#REF!") on failure. */
export function computeCell(
  row: TradeSheetRow,
  col: TradeSheetColumn,
  columnsById: Map<string, TradeSheetColumn>
): number | string {
  const visiting = new Set<string>();

  function valueOf(c: TradeSheetColumn): number {
    if (c.type === "formula") {
      if (visiting.has(c.id)) throw new FormulaError("#CIRC!");
      visiting.add(c.id);
      try {
        return evaluateFormula(c.formula ?? "", (id) => {
          const ref = columnsById.get(id);
          if (!ref) throw new FormulaError("#REF!");
          return valueOf(ref);
        });
      } finally {
        visiting.delete(c.id);
      }
    }
    const raw = row.cells[c.id];
    if (!raw?.trim()) return 0;
    const n = parseCellNumber(raw);
    if (n === null) throw new FormulaError("#VALUE!");
    return n;
  }

  try {
    return valueOf(col);
  } catch (err) {
    const msg = err instanceof FormulaError ? err.message : "";
    return msg.startsWith("#") ? msg : "#ERROR!";
  }
}
