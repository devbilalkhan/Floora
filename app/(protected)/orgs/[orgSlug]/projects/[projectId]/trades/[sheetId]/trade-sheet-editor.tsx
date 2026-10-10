"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, newId, parseCellNumber } from "@/lib/trade-sheet-types";
import type { TradeSheetColumn, TradeSheetRow } from "@/lib/trade-sheet-types";
import { computeCell, formulaToDisplay } from "@/lib/trade-sheet-formula";
import { deleteTradeSheet, renameTradeSheet, saveTradeSheet } from "../actions";
import { FormulaDialog } from "./formula-dialog";

type SaveStatus = "saved" | "unsaved" | "saving" | "conflict" | "error";

const SAVE_DELAY_MS = 800;
const UNDO_MS = 8000;
const GUTTER_WIDTH = 40; // row-number and delete-button columns

function colWidth(col: TradeSheetColumn) {
  return col.width ?? DEFAULT_COLUMN_WIDTH;
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  conflict: "Not saved",
  error: "Save failed — retrying on next edit",
};

const FORMULA_ERRORS: Record<string, string> = {
  "#REF!": "This formula uses a column that was deleted",
  "#VALUE!": "A referenced cell isn't a number",
  "#DIV/0!": "Division by zero",
  "#CIRC!": "Formulas reference each other in a loop",
  "#ERROR!": "The formula is invalid",
};

function formatTotal(n: number) {
  return n.toLocaleString("en-AU", { maximumFractionDigits: 2 });
}

function formatNumber(n: number, col: TradeSheetColumn) {
  return col.format === "currency"
    ? n.toLocaleString("en-AU", { style: "currency", currency: "AUD" })
    : formatTotal(n);
}

export function TradeSheetEditor({
  sheetId,
  projectId,
  orgSlug,
  initialName,
  initialColumns,
  initialRows,
  initialUpdatedAt,
}: {
  sheetId: string;
  projectId: string;
  orgSlug: string;
  initialName: string;
  initialColumns: TradeSheetColumn[];
  initialRows: TradeSheetRow[];
  initialUpdatedAt: string;
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(initialName);
  const savedName = useRef(initialName);
  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formulaColId, setFormulaColId] = useState<string | null>(null);
  // Cell being edited shows its raw value; other currency cells show formatted
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const latest = useRef({ columns, rows });
  const updatedAt = useRef(initialUpdatedAt);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const conflicted = useRef(false);
  const firstRender = useRef(true);

  async function flush() {
    if (conflicted.current) return;
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    try {
      const { columns, rows } = latest.current;
      const result = await saveTradeSheet(sheetId, updatedAt.current, columns, rows);
      if ("conflict" in result) {
        conflicted.current = true;
        setStatus("conflict");
        return;
      }
      updatedAt.current = result.updatedAt;
      setStatus(saveAgain.current ? "unsaved" : "saved");
    } catch {
      setStatus("error");
    } finally {
      saving.current = false;
    }
    if (saveAgain.current) {
      saveAgain.current = false;
      flush();
    }
  }

  useEffect(() => {
    latest.current = { columns, rows };
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (conflicted.current) return;
    setStatus("unsaved");
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows]);

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (status === "saved") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // ── Grid operations ────────────────────────────────────────────────────────
  function setCell(rowId: string, colId: string, value: string) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)));
  }

  function insertRow(at: number) {
    setRows((rs) => [...rs.slice(0, at), { id: newId(), cells: {} }, ...rs.slice(at)]);
  }

  function deleteRow(rowId: string) {
    const idx = rows.findIndex((r) => r.id === rowId);
    const row = rows[idx];
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    toast(`Row ${idx + 1} deleted`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => setRows((rs) => [...rs.slice(0, idx), row, ...rs.slice(idx)]),
      },
    });
  }

  function insertColumn(at: number) {
    setColumns((cs) => [
      ...cs.slice(0, at),
      { id: newId(), name: `Column ${cs.length + 1}`, type: "text" },
      ...cs.slice(at),
    ]);
  }

  function updateColumn(colId: string, patch: Partial<TradeSheetColumn>) {
    setColumns((cs) => cs.map((c) => (c.id === colId ? { ...c, ...patch } : c)));
  }

  function deleteColumn(colId: string) {
    const idx = columns.findIndex((c) => c.id === colId);
    const col = columns[idx];
    const values = new Map(rows.map((r) => [r.id, r.cells[colId]]));
    setColumns((cs) => cs.filter((c) => c.id !== colId));
    setRows((rs) =>
      rs.map((r) => {
        const { [colId]: _removed, ...cells } = r.cells;
        return { ...r, cells };
      })
    );
    toast(`Column "${col.name}" deleted`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          setColumns((cs) => [...cs.slice(0, idx), col, ...cs.slice(idx)]);
          setRows((rs) =>
            rs.map((r) => {
              const value = values.get(r.id);
              return value === undefined ? r : { ...r, cells: { ...r.cells, [colId]: value } };
            })
          );
        },
      },
    });
  }

  /** Drag the header's right edge to resize; width is saved with the column definition. */
  function startResize(e: React.PointerEvent, col: TradeSheetColumn) {
    e.preventDefault();
    const startX = e.clientX;
    // Start from the rendered width — unsized columns stretch to share the free space
    const th = (e.currentTarget as HTMLElement).closest("th");
    const startWidth = th ? th.getBoundingClientRect().width : colWidth(col);
    const onMove = (ev: PointerEvent) => {
      updateColumn(col.id, { width: Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + ev.clientX - startX)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
  }

  /** Pastes a tab/newline-separated block (copied from Excel) starting at the given cell. */
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // single value — normal paste
    e.preventDefault();

    const block = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => line.split("\t"));
    const width = Math.max(...block.map((l) => l.length));

    const cols = [...columns];
    while (cols.length < colIdx + width) {
      cols.push({ id: newId(), name: `Column ${cols.length + 1}`, type: "text" });
    }
    const nextRows = [...rows];
    while (nextRows.length < rowIdx + block.length) {
      nextRows.push({ id: newId(), cells: {} });
    }
    block.forEach((line, i) => {
      const row = nextRows[rowIdx + i];
      const cells = { ...row.cells };
      line.forEach((value, j) => {
        const col = cols[colIdx + j];
        if (col.type !== "formula") cells[col.id] = value.trim(); // formula cells are calculated
      });
      nextRows[rowIdx + i] = { ...row, cells };
    });

    setColumns(cols);
    setRows(nextRows);
  }

  function focusCell(rowIdx: number, colIdx: number) {
    // Defer so a newly-inserted row has rendered
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx}:${colIdx}"]`)
        ?.focus();
    });
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        if (e.key !== "Enter") return;
        insertRow(rows.length);
      }
      focusCell(rowIdx + 1, colIdx);
    } else if (e.key === "ArrowUp" && rowIdx > 0) {
      e.preventDefault();
      focusCell(rowIdx - 1, colIdx);
    }
  }

  // ── Sheet name / delete ────────────────────────────────────────────────────
  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(savedName.current);
      return;
    }
    if (trimmed === savedName.current) return;
    try {
      await renameTradeSheet(sheetId, projectId, orgSlug, trimmed);
      savedName.current = trimmed;
      router.refresh();
    } catch {
      toast.error("Failed to rename sheet.");
      setName(savedName.current);
    }
  }

  async function handleDelete() {
    try {
      await deleteTradeSheet(sheetId, projectId, orgSlug);
      toast.success("Sheet deleted.");
      router.push(`/orgs/${orgSlug}/projects/${projectId}`);
    } catch {
      toast.error("Failed to delete sheet.");
    }
  }

  const columnsById = new Map(columns.map((c) => [c.id, c]));
  // Formula results per cell, keyed `${rowId}:${colId}` — number, or an error code like "#REF!"
  const computed = new Map<string, number | string>();
  for (const col of columns) {
    if (col.type !== "formula") continue;
    for (const row of rows) computed.set(`${row.id}:${col.id}`, computeCell(row, col, columnsById));
  }
  const cellNumber = (row: TradeSheetRow, col: TradeSheetColumn) => {
    const v = col.type === "formula" ? computed.get(`${row.id}:${col.id}`) : parseCellNumber(row.cells[col.id]);
    return typeof v === "number" ? v : 0;
  };

  const hasNumberColumn = columns.some((c) => c.type !== "text");
  const totals = new Map(
    columns
      .filter((c) => c.type !== "text")
      .map((c) => [c.id, rows.reduce((sum, r) => sum + cellNumber(r, c), 0)])
  );
  const formulaColumn = columns.find((c) => c.id === formulaColId) ?? null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none rounded px-1 -mx-1 hover:bg-muted/30 focus:bg-muted/40"
          aria-label="Sheet name"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs ${
              status === "conflict" || status === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Sheet actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete sheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {status === "conflict" && (
        <div className="flex items-center justify-between gap-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          <span>
            Someone else changed this sheet while you were editing. Your latest edits were not saved — reload
            to see their version.
          </span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )}

      {/* Grid */}
      <div ref={gridRef} className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
        <table
          className="table-fixed border-collapse"
          // Fill the container; columns without a saved width share the spare space equally
          style={{ width: `max(100%, ${columns.reduce((sum, c) => sum + colWidth(c), 2 * GUTTER_WIDTH)}px)` }}
        >
          <colgroup>
            <col style={{ width: GUTTER_WIDTH }} />
            {columns.map((col) => (
              <col key={col.id} style={col.width ? { width: col.width } : undefined} />
            ))}
            <col style={{ width: GUTTER_WIDTH }} />
          </colgroup>
          <thead>
            <tr className="bg-muted/40">
              <th className="border-b border-r border-black/10 dark:border-white/10" />
              {columns.map((col, colIdx) => (
                <th
                  key={col.id}
                  className="relative border-b border-r border-black/10 dark:border-white/10 p-0"
                >
                  <div
                    onPointerDown={(e) => startResize(e, col)}
                    onDoubleClick={() => updateColumn(col.id, { width: undefined })}
                    className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-primary/40"
                    title="Drag to resize · double-click to reset"
                  />
                  <div className="flex items-center">
                    {col.type === "formula" && (
                      <button
                        onClick={() => setFormulaColId(col.id)}
                        className="shrink-0 pl-2 text-[10px] font-semibold italic text-primary/80 hover:text-primary"
                        title={formulaToDisplay(col.formula ?? "", columns)}
                      >
                        ƒx
                      </button>
                    )}
                    <input
                      value={col.name}
                      onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                      className={`flex-1 min-w-0 bg-transparent px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground outline-none focus:text-foreground ${
                        col.type === "text" ? "text-left" : "text-right"
                      }`}
                      aria-label="Column name"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="shrink-0 px-1.5 py-1.5 text-muted-foreground/50 hover:text-foreground"
                          aria-label="Column options"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => updateColumn(col.id, { type: "text" })}>
                          <Check className={`h-3.5 w-3.5 ${col.type === "text" ? "" : "invisible"}`} />
                          Text
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => updateColumn(col.id, { type: "number" })}>
                          <Check className={`h-3.5 w-3.5 ${col.type === "number" ? "" : "invisible"}`} />
                          Number (with total)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setFormulaColId(col.id)}>
                          <Check className={`h-3.5 w-3.5 ${col.type === "formula" ? "" : "invisible"}`} />
                          {col.type === "formula" ? "Edit formula…" : "Formula…"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            updateColumn(
                              col.id,
                              col.format === "currency"
                                ? { format: undefined }
                                : { format: "currency", type: col.type === "text" ? "number" : col.type }
                            )
                          }
                        >
                          <Check className={`h-3.5 w-3.5 ${col.format === "currency" && col.type !== "text" ? "" : "invisible"}`} />
                          Currency ($)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => insertColumn(colIdx)}>
                          <ArrowLeftToLine className="h-3.5 w-3.5" />
                          Insert column left
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => insertColumn(colIdx + 1)}>
                          <ArrowRightToLine className="h-3.5 w-3.5" />
                          Insert column right
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={columns.length === 1}
                          onSelect={() => deleteColumn(col.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              ))}
              <th className="border-b border-black/10 dark:border-white/10 p-0">
                <button
                  onClick={() => insertColumn(columns.length)}
                  className="flex h-full w-full items-center justify-center py-1.5 text-muted-foreground hover:text-primary"
                  aria-label="Add column"
                  title="Add column"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id} className="group border-b border-black/5 dark:border-white/5">
                <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 p-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-full px-2 py-1.5 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
                        aria-label={`Row ${rowIdx + 1} options`}
                      >
                        {rowIdx + 1}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => insertRow(rowIdx)}>
                        <ArrowUpToLine className="h-3.5 w-3.5" />
                        Insert row above
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => insertRow(rowIdx + 1)}>
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Insert row below
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => deleteRow(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete row
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                {columns.map((col, colIdx) => {
                  if (col.type === "formula") {
                    const result = computed.get(`${row.id}:${col.id}`);
                    return (
                      <td key={col.id} className="border-r border-black/10 dark:border-white/10 bg-muted/20 p-0">
                        <input
                          readOnly
                          tabIndex={-1}
                          data-cell={`${rowIdx}:${colIdx}`}
                          value={typeof result === "number" ? formatNumber(result, col) : result ?? ""}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                          title={typeof result === "string" ? FORMULA_ERRORS[result] : undefined}
                          className={`w-full cursor-default bg-transparent px-2 py-1.5 text-right text-xs tabular-nums outline-none ${
                            typeof result === "string" ? "text-destructive" : "text-foreground/70"
                          }`}
                        />
                      </td>
                    );
                  }
                  const value = row.cells[col.id] ?? "";
                  const parsed = col.type === "number" ? parseCellNumber(value) : null;
                  const invalidNumber = col.type === "number" && value !== "" && parsed === null;
                  const cellKey = `${row.id}:${col.id}`;
                  const display =
                    col.format === "currency" && parsed !== null && editingCell !== cellKey
                      ? formatNumber(parsed, col)
                      : value;
                  return (
                    <td key={col.id} className="border-r border-black/10 dark:border-white/10 p-0">
                      <input
                        data-cell={`${rowIdx}:${colIdx}`}
                        value={display}
                        onFocus={() => setEditingCell(cellKey)}
                        onBlur={() => setEditingCell(null)}
                        onChange={(e) => setCell(row.id, col.id, e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                        inputMode={col.type === "number" ? "decimal" : undefined}
                        className={`w-full bg-transparent px-2 py-1.5 text-xs outline-none focus:bg-primary/5 focus:ring-1 focus:ring-inset focus:ring-primary/50 ${
                          col.type === "number" ? "text-right tabular-nums" : ""
                        } ${invalidNumber ? "text-destructive" : "text-foreground/70"}`}
                      />
                    </td>
                  );
                })}
                <td className="p-0 text-center">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity"
                    aria-label={`Delete row ${rowIdx + 1}`}
                    title="Delete row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {hasNumberColumn && rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/40 border-t border-black/10 dark:border-white/10">
                <td className="border-r border-black/10 dark:border-white/10" />
                {columns.map((col, colIdx) => (
                  <td
                    key={col.id}
                    className={`border-r border-black/10 dark:border-white/10 px-2 py-1.5 text-xs font-semibold ${
                      col.type !== "text" ? "text-right tabular-nums" : "text-muted-foreground"
                    }`}
                  >
                    {col.type !== "text" ? formatNumber(totals.get(col.id) ?? 0, col) : colIdx === 0 ? "Total" : ""}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => insertRow(rows.length)}>
          <Plus className="h-3.5 w-3.5" />
          Add row
        </Button>
        <p className="text-xs text-muted-foreground/50">
          Tip: copy a block of cells in Excel and paste into any cell.
        </p>
      </div>

      <FormulaDialog
        column={formulaColumn}
        columns={columns}
        onClose={() => setFormulaColId(null)}
        onSave={(formula) => {
          updateColumn(formulaColId!, { type: "formula", formula });
          setFormulaColId(null);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the sheet and all its data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
