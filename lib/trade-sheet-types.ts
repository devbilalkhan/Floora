export type TradeSheetColumn = {
  id: string;
  name: string;
  type: "text" | "number" | "formula";
  /** Only for formula columns — stored with {columnId} references (see trade-sheet-formula.ts). */
  formula?: string;
  /** Display format for number/formula columns. Values are stored unformatted. */
  format?: "currency";
  /** Column width in px; falls back to DEFAULT_COLUMN_WIDTH when unset. */
  width?: number;
};

export const DEFAULT_COLUMN_WIDTH = 160;
export const MIN_COLUMN_WIDTH = 60;

export type TradeSheetRow = {
  id: string;
  /** Raw cell text keyed by column id — kept as strings so inputs never fight the cursor. */
  cells: Record<string, string>;
};

export const TRADE_LABELS: Record<string, string> = {
  wall_door_protection: "Wall & Door Protection",
};

export function newId() {
  return crypto.randomUUID();
}

/** Parses a cell as a number, tolerating "$1,234.50" style input. Returns null when not numeric. */
export function parseCellNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function defaultSheet(): { columns: TradeSheetColumn[]; rows: TradeSheetRow[] } {
  const columns: TradeSheetColumn[] = Array.from({ length: 8 }, (_, i) => ({
    id: newId(),
    name: i === 0 ? "Item" : `Column ${i + 1}`,
    type: "text" as const,
  }));
  const rows = Array.from({ length: 5 }, () => ({ id: newId(), cells: {} }));
  return { columns, rows };
}
