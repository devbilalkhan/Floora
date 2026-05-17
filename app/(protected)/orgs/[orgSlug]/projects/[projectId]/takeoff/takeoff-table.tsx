"use client";

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, LEVELS } from "./constants";
import type { TakeoffRow } from "./constants";
import { CalcInput } from "@/components/calc-input";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export type { TakeoffRow };

const cell =
  "h-full w-full px-2 py-1 text-xs bg-transparent border-0 outline-none " +
  "focus:ring-1 focus:ring-inset focus:ring-primary/40 " +
  "placeholder:text-muted-foreground/25 text-foreground/70";

const selectCell =
  "h-full w-full px-2 py-1 text-xs border-0 outline-none cursor-pointer " +
  "appearance-none bg-card focus:ring-1 focus:ring-inset focus:ring-primary/40 " +
  "text-foreground/70";

// Initial column widths (px). Sum = 1280. Flex description col (index 3) pre-calculated.
// Cols: # | Code | Mfr | Description | Colour | Location | Level | Qty | Unit | Waste% | Wastage | Parent Code | Cove H. | Notes | Del
const INIT_WIDTHS = [32, 84, 124, 100, 68, 84, 60, 72, 52, 56, 56, 56, 56, 252, 32];
const COL_MIN = 32;

// ── Single editable row ────────────────────────────────────────────────────────

function TakeoffRowComp({
  row,
  index,
  finishMapRef,
  onUpdate,
  onDelete,
  onAddSibling,
}: {
  row: TakeoffRow;
  index: number;
  finishMapRef: React.MutableRefObject<Record<string, Partial<TakeoffRow>>>;
  onUpdate: (id: string, patch: Partial<TakeoffRow>) => void;
  onDelete: (id: string) => void;
  onAddSibling: () => void;
}) {
  const [local, setLocal] = useState(row);
  const pending = useRef<Partial<TakeoffRow>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal((prev) => ({ ...prev, ...row }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  // Cancel any pending save on unmount
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, []);

  // Schedule a debounced save (600ms after last change)
  const schedule = useCallback((patch: Partial<TakeoffRow>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onUpdate(row.id, pending.current);
      pending.current = {};
      timer.current = null;
    }, 600);
  }, [row.id, onUpdate]);

  // Flush pending + immediate save (called on blur / select change)
  const flush = useCallback((patch: Partial<TakeoffRow>) => {
    const full = { ...pending.current, ...patch };
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = {};
    if (Object.keys(full).length > 0) onUpdate(row.id, full);
  }, [row.id, onUpdate]);

  const set = (field: keyof TakeoffRow, value: unknown) =>
    setLocal((prev) => ({ ...prev, [field]: value }));

  const handleChange = (field: keyof TakeoffRow, value: unknown) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    schedule({ [field]: value } as Partial<TakeoffRow>);
  };

  const handleBlur = (field: keyof TakeoffRow, value: string | null) => {
    const v = value || null;
    setLocal((prev) => ({ ...prev, [field]: v }));
    flush({ [field]: v } as Partial<TakeoffRow>);
  };

  const handleCodeBlur = (code: string) => {
    const trimmed = code.trim();
    const patch: Partial<TakeoffRow> = { finish_code: trimmed || null };
    if (trimmed) {
      const match = finishMapRef.current[trimmed.toUpperCase()];
      if (match) {
        if (!local.description && match.description) patch.description = match.description;
        if (!local.manufacturer && match.manufacturer) patch.manufacturer = match.manufacturer;
        if (!local.colour && match.colour) patch.colour = match.colour;
      }
    }
    setLocal((prev) => ({ ...prev, ...patch }));
    flush(patch);
  };

  const handleQtyBlur = (raw: string) => {
    const qty = parseFloat(raw) || 0;
    set("qty", qty);
    flush({ qty });
  };

  const handleWastePctBlur = (raw: string) => {
    const pct = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    set("waste_pct", pct);
    flush({ waste_pct: pct });
  };

  const handleSelectChange = (field: keyof TakeoffRow, value: string | null) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    flush({ [field]: value } as Partial<TakeoffRow>);
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAddSibling(); }
  };

  return (
    <tr className="border-b border-border hover:bg-muted/10 group">
      <td className="text-center text-[10px] text-muted-foreground/40 select-none px-1 py-0">
        {index}
      </td>

      <td className="border-r border-border p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              list="finish-codes"
              value={local.finish_code ?? ""}
              onChange={(e) => handleChange("finish_code", e.target.value)}
              onBlur={(e) => handleCodeBlur(e.target.value)}
              onKeyDown={onEnter}
              className={cn(cell, "font-mono uppercase tracking-wide")}
              placeholder="A-01"
            />
          </TooltipTrigger>
          {local.finish_code && <TooltipContent className="text-[11px] px-2 py-0.5">{local.finish_code}</TooltipContent>}
        </Tooltip>
      </td>

      <td className="border-r border-border p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              value={local.manufacturer ?? ""}
              onChange={(e) => handleChange("manufacturer", e.target.value)}
              onBlur={(e) => handleBlur("manufacturer", e.target.value)}
              onKeyDown={onEnter}
              className={cell}
              placeholder="Manufacturer / range"
            />
          </TooltipTrigger>
          {local.manufacturer && <TooltipContent className="text-[11px] px-2 py-0.5">{local.manufacturer}</TooltipContent>}
        </Tooltip>
      </td>

      <td className="border-r border-border p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              value={local.description ?? ""}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={(e) => handleBlur("description", e.target.value)}
              onKeyDown={onEnter}
              className={cell}
              placeholder="Product name"
            />
          </TooltipTrigger>
          {local.description && <TooltipContent className="text-[11px] px-2 py-0.5">{local.description}</TooltipContent>}
        </Tooltip>
      </td>

      <td className="border-r border-border p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              value={local.colour ?? ""}
              onChange={(e) => handleChange("colour", e.target.value)}
              onBlur={(e) => handleBlur("colour", e.target.value)}
              onKeyDown={onEnter}
              className={cell}
              placeholder="Colour / code"
            />
          </TooltipTrigger>
          {local.colour && <TooltipContent className="text-[11px] px-2 py-0.5">{local.colour}</TooltipContent>}
        </Tooltip>
      </td>

      <td className="border-r border-border p-0">
        <input
          value={local.location ?? ""}
          onChange={(e) => handleChange("location", e.target.value)}
          onBlur={(e) => handleBlur("location", e.target.value)}
          onKeyDown={onEnter}
          className={cell}
          placeholder="Room / area"
        />
      </td>

      <td className="border-r border-border p-0">
        <select
          value={local.level ?? ""}
          onChange={(e) => handleSelectChange("level", e.target.value || null)}
          className={selectCell}
        >
          <option value="">—</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </td>

      <td className="border-r border-border p-0">
        <CalcInput
          value={local.qty}
          onCommit={(v) => { set("qty", v); flush({ qty: v }); }}
          onKeyDown={onEnter}
          className={cn(cell, "text-right tabular-nums")}
          placeholder="0.00"
        />
      </td>

      <td className="border-r border-border p-0">
        <select
          value={local.unit}
          onChange={(e) => handleSelectChange("unit", e.target.value)}
          className={selectCell}
        >
          <option value="m2">m²</option>
          <option value="lm">lm</option>
          <option value="blm">blm</option>
          <option value="ea">ea</option>
        </select>
      </td>

      {/* Waste % — editable */}
      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.waste_pct === 0 ? "" : local.waste_pct}
          onChange={(e) => handleChange("waste_pct", parseFloat(e.target.value) || 0)}
          onBlur={(e) => handleWastePctBlur(e.target.value)}
          onKeyDown={onEnter}
          className={cn(cell, "text-right tabular-nums")}
          placeholder="10"
          min={0}
          max={100}
          step={1}
        />
      </td>

      {/* Wastage — supply qty (actual + waste), read-only */}
      <td className="border-r border-border p-0 bg-primary/5">
        <input
          type="text"
          value={local.qty > 0 ? String(Math.ceil(local.qty * (1 + (local.waste_pct ?? 10) / 100))) : ""}
          disabled
          className={cn(cell, "text-right tabular-nums text-primary cursor-default select-none bg-transparent")}
          placeholder="—"
        />
      </td>

      {/* Parent Code — coving_skirting rows only */}
      <td className="border-r border-border p-0">
        {local.scope_category === "coving_skirting" ? (
          <input
            list="finish-codes"
            value={local.parent_finish_code ?? ""}
            onChange={(e) => handleChange("parent_finish_code", e.target.value || null)}
            onBlur={(e) => flush({ parent_finish_code: e.target.value.trim() || null })}
            onKeyDown={onEnter}
            className={cn(cell, "font-mono uppercase tracking-wide")}
            placeholder="RF-01"
          />
        ) : (
          <span className="block h-full w-full px-2 py-1 text-xs text-muted-foreground/20 select-none">—</span>
        )}
      </td>

      {/* Cove Height — coving_skirting rows only */}
      <td className="border-r border-border p-0">
        {local.scope_category === "coving_skirting" ? (
          <select
            value={local.cove_height_mm ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              set("cove_height_mm", v);
              flush({ cove_height_mm: v });
            }}
            className={selectCell}
          >
            <option value="">—</option>
            <option value="100">100</option>
            <option value="150">150</option>
            <option value="200">200</option>
          </select>
        ) : (
          <span className="block h-full w-full px-2 py-1 text-xs text-muted-foreground/20 select-none">—</span>
        )}
      </td>

      <td className="border-r border-border p-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              value={local.notes ?? ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              onBlur={(e) => handleBlur("notes", e.target.value)}
              onKeyDown={onEnter}
              className={cell}
              placeholder="Notes / DWG ref…"
            />
          </TooltipTrigger>
          {local.notes && <TooltipContent className="text-[11px] px-2 py-0.5">{local.notes}</TooltipContent>}
        </Tooltip>
      </td>

      <td className="w-8 text-center p-0">
        <button
          onClick={() => onDelete(row.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive transition-all"
          title="Delete row"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Main table component ───────────────────────────────────────────────────────

export function TakeoffTable({
  takeoffId,
  initialRows,
}: {
  takeoffId: string;
  initialRows: TakeoffRow[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<TakeoffRow[]>(initialRows);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishMap = useRef<Record<string, Partial<TakeoffRow>>>({});

  // Column resize
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState(INIT_WIDTHS);
  const colWidthsRef = useRef(INIT_WIDTHS);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  // On mount, expand description column to fill available container width
  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const available = el.clientWidth;
    const base = INIT_WIDTHS.reduce((s, w) => s + w, 0);
    if (available <= base) return;
    const next = [...INIT_WIDTHS];
    next[3] += available - base; // description col absorbs extra space
    setColWidths(next);
    colWidthsRef.current = next;
  }, []);

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidths = [...colWidthsRef.current];
    const startX = e.clientX;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const total = startWidths[colIndex] + startWidths[colIndex + 1];
      const newLeft = Math.min(total - COL_MIN, Math.max(COL_MIN, startWidths[colIndex] + delta));
      setColWidths((prev) => {
        const next = [...prev];
        next[colIndex] = newLeft;
        next[colIndex + 1] = total - newLeft;
        return next;
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    return () => { if (statusTimer.current) clearTimeout(statusTimer.current) };
  }, [supabase]);

  useEffect(() => {
    rows.forEach((r) => {
      if (r.finish_code) {
        const k = r.finish_code.toUpperCase();
        finishMap.current[k] = {
          description: r.description,
          manufacturer: r.manufacturer,
          colour: r.colour,
        };
      }
    });
  }, [rows]);

  const updateRow = useCallback(
    (id: string, patch: Partial<TakeoffRow>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setSaveStatus("saving");
      supabase
        .from("project_takeoff")
        .update(patch)
        .eq("id", id)
        .then(() => {
          setSaveStatus("saved");
          if (statusTimer.current) clearTimeout(statusTimer.current);
          statusTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
        });
    },
    [supabase]
  );

  const addRow = useCallback(
    async (category: string) => {
      if (!userId) return;
      const cat = CATEGORIES.find((c) => c.key === category)!;
      const inCat = rows.filter((r) => r.scope_category === category);
      const nextOrder = inCat.length
        ? Math.max(...inCat.map((r) => r.sort_order)) + 1
        : 0;

      const tempId = `temp-${Date.now()}`;
      const optimistic: TakeoffRow = {
        id: tempId,
        scope_category: category,
        finish_code: null,
        description: null,
        manufacturer: null,
        colour: null,
        location: null,
        level: null,
        qty: 0,
        unit: cat.defaultUnit,
        waste_pct: 10,
        notes: null,
        sort_order: nextOrder,
        parent_finish_code: null,
        cove_height_mm: null,
      };
      setRows((prev) => [...prev, optimistic]);

      const { data, error } = await supabase
        .from("project_takeoff")
        .insert({
          takeoff_id: takeoffId,
          created_by: userId,
          scope_category: category,
          sort_order: nextOrder,
          qty: 0,
          unit: cat.defaultUnit,
        })
        .select()
        .single();

      if (error) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === tempId ? (data as TakeoffRow) : r))
      );
    },
    [userId, rows, takeoffId, supabase]
  );

  const deleteRow = useCallback(
    async (id: string) => {
      setRows((prev) => prev.filter((r) => r.id !== id));
      await supabase.from("project_takeoff").delete().eq("id", id);
    },
    [supabase]
  );

  const allCodes = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.finish_code).filter((c): c is string => Boolean(c)))
      ),
    [rows]
  );

  const grandTotal = useMemo(
    () =>
      rows.reduce((acc, r) => {
        if (r.qty > 0) acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
        return acc;
      }, {} as Record<string, number>),
    [rows]
  );

  const grandSupply = useMemo(
    () =>
      rows.reduce((acc, r) => {
        if (r.qty > 0) {
          const pct = r.waste_pct ?? 10;
          acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty) * (1 + pct / 100);
        }
        return acc;
      }, {} as Record<string, number>),
    [rows]
  );

  // Code summary: group rows by finish_code, consolidate quantities
  const codeSummary = useMemo(() => {
    const map: Record<
      string,
      {
        finish_code: string;
        description: string | null;
        manufacturer: string | null;
        colour: string | null;
        scope_category: string;
        totals: Record<string, number>;
        supply: Record<string, number>;
        locations: string[];
      }
    > = {};

    rows.forEach((r) => {
      if (!r.finish_code) return;
      const k = r.finish_code;
      if (!map[k]) {
        map[k] = {
          finish_code: k,
          description: r.description,
          manufacturer: r.manufacturer,
          colour: r.colour,
          scope_category: r.scope_category,
          totals: {},
          supply: {},
          locations: [],
        };
      }
      const entry = map[k];
      if (r.qty > 0) {
        entry.totals[r.unit] = (entry.totals[r.unit] || 0) + Number(r.qty);
        entry.supply[r.unit] = (entry.supply[r.unit] || 0) + Number(r.qty) * (1 + r.waste_pct / 100);
      }
      if (r.location && !entry.locations.includes(r.location))
        entry.locations.push(r.location);
    });

    return Object.values(map).sort((a, b) => a.finish_code.localeCompare(b.finish_code));
  }, [rows]);

  const fmt = (n: number) =>
    n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const uLabel = (u: string) => (u === "m2" ? "m²" : u);

  return (
    <TooltipProvider delayDuration={500}>
    <div className="space-y-3">
      <datalist id="finish-codes">
        {allCodes.map((c) => <option key={c} value={c} />)}
      </datalist>

      {/* Main takeoff table */}
      <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
        <div className="overflow-x-auto" ref={tableWrapRef}>
          <table
            className="border-collapse"
            style={{ width: colWidths.reduce((s, w) => s + w, 0), tableLayout: "fixed" }}
          >
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>

            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {(
                  [
                    ["#",                    "text-center"],
                    ["Code",                 "text-left"],
                    ["Manufacturer / Range", "text-left"],
                    ["Description",          "text-left"],
                    ["Colour",               "text-left"],
                    ["Location",             "text-left"],
                    ["Level",                "text-left"],
                    ["Qty",                  "text-right"],
                    ["Unit",                 "text-left"],
                    ["Waste %",              "text-right"],
                    ["Wastage",              "text-right"],
                    ["Parent Code",          "text-left"],
                    ["Cove H.",              "text-left"],
                    ["Notes / Ref",          "text-left"],
                    ["",                     ""],
                  ] as [string, string][]
                ).map(([label, align], i, arr) => (
                  <th
                    key={i}
                    className={cn(
                      "px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0 relative overflow-hidden select-none",
                      align
                    )}
                  >
                    <span className="block truncate">{label}</span>
                    {i < arr.length - 1 && (
                      <div
                        onMouseDown={(e) => startResize(i, e)}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {CATEGORIES.map((cat) => {
                const catRows = rows
                  .filter((r) => r.scope_category === cat.key)
                  .sort((a, b) => a.sort_order - b.sort_order);

                if (catRows.length === 0) return null;

                const catTotals = catRows.reduce((acc, r) => {
                  if (r.qty > 0) acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
                  return acc;
                }, {} as Record<string, number>);

                const catSupply = catRows.reduce((acc, r) => {
                  if (r.qty > 0) {
                    const pct = r.waste_pct ?? 10;
                    acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty) * (1 + pct / 100);
                  }
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <React.Fragment key={cat.key}>
                    <tr className="bg-muted/20 border-t border-b border-border">
                      <td colSpan={15} className="px-3 py-1">
                        <div className="flex items-center justify-between">
                          {/* Lighter in light mode, slightly muted in dark */}
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {cat.label}
                          </span>
                          <div className="flex items-center gap-5">
                            {Object.entries(catTotals).map(([unit, net]) => (
                              <div key={unit} className="flex items-center gap-1.5 text-[11px] tabular-nums">
                                <span className="text-muted-foreground">net</span>
                                <span className="text-foreground/70">{fmt(net)}</span>
                                <span className="text-muted-foreground/50">→</span>
                                <span className="text-muted-foreground">supply</span>
                                <span className="text-primary font-medium">{fmt(catSupply[unit] ?? net)}</span>
                                <span className="text-muted-foreground">{uLabel(unit)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {catRows.map((row, i) => (
                      <TakeoffRowComp
                        key={row.id}
                        row={row}
                        index={i + 1}
                        finishMapRef={finishMap}
                        onUpdate={updateRow}
                        onDelete={deleteRow}
                        onAddSibling={() => addRow(cat.key)}
                      />
                    ))}

                    <tr>
                      <td colSpan={15} className="px-3 py-0.5 border-b border-border">
                        <button
                          onClick={() => addRow(cat.key)}
                          className="flex items-center gap-1 text-[11px] text-primary/60 dark:text-primary hover:text-primary transition-colors py-0.5"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Add row
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand total + save indicator */}
      {(Object.keys(grandTotal).length > 0 || saveStatus !== "idle") && (
        <div className="flex items-center gap-6 px-4 py-2 bg-card/65 backdrop-blur-xl border border-border rounded-sm">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
            Totals
          </span>
          <div className="flex items-center gap-5 flex-1">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              net → supply
            </span>
            {Object.entries(grandTotal).map(([unit, actual]) => (
              <div key={unit} className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xs font-medium text-muted-foreground">{uLabel(unit)}</span>
                <span className="text-sm tabular-nums text-foreground/70">{fmt(actual)}</span>
                <span className="text-muted-foreground/50 text-xs">→</span>
                <span className="text-sm font-semibold tabular-nums text-primary">{fmt(grandSupply[unit] ?? actual)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] text-primary">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Saving
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Check className="h-2.5 w-2.5" />
                Saved
              </span>
            )}
            <span className="text-[11px] text-muted-foreground/70">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          </div>
        </div>
      )}

      {/* Code Summary — consolidated per finish code, feeds into estimate costing */}
      {codeSummary.length > 0 && (
        <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
          <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Code Summary
            </span>
            <span className="text-[10px] text-muted-foreground/50">
              {codeSummary.length} {codeSummary.length === 1 ? "code" : "codes"} · consolidated for estimate
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <colgroup>
                <col style={{ width: 84 }} />
                <col style={{ width: 108 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 68 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 52 }} />
              </colgroup>
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {[
                    ["Code",         "text-left"],
                    ["Category",     "text-left"],
                    ["Description",  "text-left"],
                    ["Manufacturer", "text-left"],
                    ["Colour",       "text-left"],
                    ["Net m²",       "text-right"],
                    ["Supply m²",    "text-right"],
                    ["Net lm",       "text-right"],
                    ["Supply lm",    "text-right"],
                    ["Net blm",      "text-right"],
                    ["Supply blm",   "text-right"],
                    ["ea",           "text-right"],
                    ["Locations",    "text-right"],
                  ].map(([label, align], i) => (
                    <th
                      key={i}
                      className={cn(
                        "px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0",
                        align
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codeSummary.map((entry) => {
                  const catLabel =
                    CATEGORIES.find((c) => c.key === entry.scope_category)?.label ?? entry.scope_category;
                  return (
                    <tr key={entry.finish_code} className="border-b border-border hover:bg-muted/10">
                      <td className="px-2 py-1 text-xs font-mono font-medium text-foreground/70 border-r border-border">
                        {entry.finish_code}
                      </td>
                      <td className="px-2 py-1 text-[11px] text-muted-foreground border-r border-border">
                        {catLabel}
                      </td>
                      <td className="px-2 py-1 text-xs text-foreground/70 border-r border-border">
                        {entry.description ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-foreground/70 border-r border-border truncate max-w-0">
                        {entry.manufacturer ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-foreground/70 border-r border-border">
                        {entry.colour ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums text-foreground/70 border-r border-border">
                        {entry.totals["m2"] ? fmt(entry.totals["m2"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums font-medium text-primary border-r border-border">
                        {entry.supply["m2"] ? fmt(entry.supply["m2"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums text-foreground/70 border-r border-border">
                        {entry.totals["lm"] ? fmt(entry.totals["lm"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums font-medium text-primary border-r border-border">
                        {entry.supply["lm"] ? fmt(entry.supply["lm"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums text-foreground/70 border-r border-border">
                        {entry.totals["blm"] ? fmt(entry.totals["blm"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums font-medium text-primary border-r border-border">
                        {entry.supply["blm"] ? fmt(entry.supply["blm"]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums text-foreground/70 border-r border-border">
                        {entry.totals["ea"] ? entry.totals["ea"] : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1 text-xs text-right tabular-nums text-foreground/70">
                        {entry.locations.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
