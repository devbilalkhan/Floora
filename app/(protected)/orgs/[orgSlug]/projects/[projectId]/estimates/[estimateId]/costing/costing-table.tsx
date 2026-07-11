"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Trash2, Plus, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORIES, LEVELS } from "@/lib/takeoff-types";
import { CalcInput } from "@/components/calc-input";
import { FloorPrepPanel } from "@/components/floor-prep-panel";
import { WetAreasPanel } from "@/components/wet-areas-panel";
import type { Estimate, EstimateItem, EstimateSettings, WetArea } from "@/lib/estimate-types";
import {
  itemMatQty,
  itemMatCost,
  itemLabCost,
  itemTotal,
  computeSummary,
} from "@/lib/estimate-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { COVERAGE_M2 } from "@/lib/default-rates";
import {
  updateEstimateItem,
  deleteEstimateItem,
  addEstimateItem,
  updateEstimateSettings,
  importTakeoff,
  syncAutoConsumables,
  syncSectionConsumables,
  addCovingToItem,
  removeCovingFromItem,
  restoreAutoConsumables,
} from "./actions";

// Coving children are excluded from floor-area-based qty recalculation
const COVING_DESCS = new Set(["Contact Brushable (Max Bond 102)", "Cove Fillet", "Coving Labour"]);

const VINYL_SCOPES = new Set(["vinyl", "wall_vinyl"]);

// Recompute section consumable qtys from a list of items (optimistic client update)
function applySectionConsumableQtys(items: EstimateItem[], scope: string): EstimateItem[] {
  const primaries = items.filter(i => i.scope_category === scope && i.type === "primary" && !i.parent_item_id);
  const totalArea   = primaries.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const gluableArea = primaries.filter(p => p.product_type !== "plank_floating").reduce((s, p) => s + (Number(p.qty) || 0), 0);
  return items.map(i => {
    if (!(i.scope_category === scope && i.is_auto && !i.parent_item_id && i.type === "consumable")) return i;
    let qty = i.qty;
    if (i.description === "Feather Finish 20kg")   qty = totalArea   > 0 ? Math.ceil(totalArea   / COVERAGE_M2) : 0;
    if (i.description === "Feather Finish Labour")  qty = totalArea;
    if (i.description === "Glue Sheet/Plank")       qty = gluableArea > 0 ? Math.ceil(gluableArea / COVERAGE_M2) : 0;
    return { ...i, qty };
  });
}

const FLOOR_PREP_DEFAULTS = {
  floor_prep_area: 0,
  floor_prep_depth_mm: 3,
  floor_prep_charge_per_bag: 0,
  floor_prep_mat_per_bag: 33,
  floor_prep_lab_per_bag: 40,
  grind_area: 0,
  grind_labor_rate: 0,
  grind_charge_rate: 0,
} as const;

// Client-side mirror of the server sync logic
function calcAutoChildQty(child: EstimateItem, parentQty: number): number {
  if (COVING_DESCS.has(child.description ?? "")) return child.qty; // coving geometry — leave alone
  if (child.coverage_m2) return Math.ceil(parentQty / child.coverage_m2);
  if (child.unit === "m2") return parentQty;
  return child.qty;
}

// Deterministic badge colour from manufacturer name
const BRAND_HUES = [210, 160, 280, 40, 0, 190, 330, 90];
function brandHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return BRAND_HUES[h % BRAND_HUES.length];
}

// ── Shared cell styles ────────────────────────────────────────────────────────
const cell =
  "h-full w-full px-2 py-1 text-[11px] bg-transparent border-0 outline-none " +
  "focus:ring-1 focus:ring-inset focus:ring-primary/40 " +
  "placeholder:text-muted-foreground/55 text-black dark:text-foreground/70";

const cellRight = cell + " text-right tabular-nums";
const cellMono = cell + " font-mono uppercase tracking-wide";

const readonlyCell =
  "h-full w-full px-2 py-1 text-[11px] tabular-nums text-right text-black dark:text-foreground/70 select-none cursor-default";

const dimCell =
  "h-full w-full px-2 py-1 text-[11px] text-muted-foreground/45 select-none";

const selectCell =
  "h-full w-full px-2 py-1 text-xs border-0 outline-none cursor-pointer " +
  "appearance-none bg-transparent focus:ring-1 focus:ring-inset focus:ring-primary/40 " +
  "text-black dark:text-foreground/70";

const INIT_WIDTHS = [28, 76, 200, 64, 52, 52, 108, 84, 84, 80, 80, 96, 28];
// # | Code | Description | Qty | Unit | Waste% | Eff.Qty | Mat$/u | Lab$/u | Mat$ | Lab$ | Total | Del
const COL_MIN = 28;

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) =>
  (n * 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Round to 2dp for input display — strips trailing zeros, prevents >2dp
const r2 = (n: number) => parseFloat((n || 0).toFixed(2));
const uLabel = (u: string) =>
  u === "m2" ? "m²" : u === "blm" ? "blm" : u;

// ── Primary row ───────────────────────────────────────────────────────────────
function PrimaryRow({
  item,
  index,
  estimateId,
  onUpdate,
  onDelete,
  onCovingAdded,
  onCovingRemoved,
  hasWeldRod,
  onConsumableAdded,
  confirmedPrice,
}: {
  item: EstimateItem;
  index: number;
  estimateId: string;
  onUpdate: (id: string, patch: Partial<EstimateItem>) => void;
  onDelete: (id: string) => void;
  onCovingAdded: (primaryId: string, children: EstimateItem[], covLm: number, covArea: number, covHeightMm: number) => void;
  onCovingRemoved: (primaryId: string) => void;
  hasWeldRod: boolean;
  onConsumableAdded: (items: EstimateItem[]) => void;
  confirmedPrice?: number;
}) {
  const [local, setLocal] = useState(item);
  const pending = useRef<Partial<EstimateItem>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coving modal state
  const [covingOpen, setCovingOpen] = useState(false);
  const [covFormLm, setCovFormLm] = useState(0);
  const [covFormHeight, setCovFormHeight] = useState(100);

  // Manufacturer badge edit state
  const [editingBrand, setEditingBrand] = useState(false);

  useEffect(() => {
    setLocal((prev) => ({ ...prev, ...item }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = useCallback(
    (patch: Partial<EstimateItem>) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onUpdate(item.id, pending.current);
        pending.current = {};
        timer.current = null;
      }, 600);
    },
    [item.id, onUpdate]
  );

  const flush = useCallback(
    (patch: Partial<EstimateItem>) => {
      const full = { ...pending.current, ...patch };
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      pending.current = {};
      if (Object.keys(full).length > 0) onUpdate(item.id, full);
    },
    [item.id, onUpdate]
  );

  const set = (field: keyof EstimateItem, value: unknown) =>
    setLocal((prev) => ({ ...prev, [field]: value }));

  const effQty = itemMatQty(local);
  const matCost = itemMatCost(local);
  const labCost = itemLabCost(local);
  const total = itemTotal(local);

  const isVinyl = local.scope_category === "vinyl" || local.scope_category === "wall_vinyl";
  const isPlankType = local.product_type === "plank_glued" || local.product_type === "plank_floating";
  const hasCov = (local.cov_lm ?? 0) > 0;

  const openCovingForm = () => {
    setCovFormLm(local.cov_lm ?? 0);
    setCovFormHeight(local.cov_height_mm ?? 150);
    setCovingOpen(true);
  };

  const handleAddWeldRod = async () => {
    const newItems = await restoreAutoConsumables(item.id, estimateId, local.scope_category, local.qty);
    if (newItems.length > 0) onConsumableAdded(newItems);
  };

  const handleApplyCoving = async () => {
    if (!covFormLm) { setCovingOpen(false); return; }
    const children = await addCovingToItem(
      item.id, estimateId, local.scope_category,
      covFormLm, covFormHeight,
      /* startSortOrder rough estimate */ local.sort_order + 100
    );
    const covArea = covFormLm * (covFormHeight / 1000);
    setLocal(prev => ({ ...prev, cov_lm: covFormLm, cov_area: covArea, cov_height_mm: covFormHeight }));
    onCovingAdded(item.id, children, covFormLm, covArea, covFormHeight);
    setCovingOpen(false);
  };

  const handleRemoveCoving = async () => {
    setLocal(prev => ({ ...prev, cov_lm: null, cov_area: null, cov_height_mm: null }));
    onCovingRemoved(item.id);
    await removeCovingFromItem(item.id);
  };

  const hue = local.manufacturer ? brandHue(local.manufacturer) : null;

  const liveArea = covFormLm * (covFormHeight / 1000);

  return (
    <tr className="border-b border-border hover:bg-muted/20 group">
      {/* Coving dialog */}
      <Dialog open={covingOpen} onOpenChange={setCovingOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {hasCov ? "Edit Coving" : "Add Coving"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Live m² tag */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Coving area</span>
              <span className={cn(
                "tabular-nums font-semibold text-sm px-2.5 py-0.5 rounded-md border transition-colors",
                liveArea > 0
                  ? "bg-secondary/10 text-secondary border-secondary/30"
                  : "bg-muted/40 text-muted-foreground border-border"
              )}>
                {liveArea > 0 ? `${liveArea.toFixed(2)} m²` : "— m²"}
              </span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Linear metres (lm)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={covFormLm || ""}
                onChange={e => setCovFormLm(parseFloat(e.target.value) || 0)}
                className="w-full text-sm tabular-nums bg-input border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
                placeholder="0.00"
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Height</span>
              <select
                value={covFormHeight}
                onChange={e => setCovFormHeight(Number(e.target.value))}
                className="w-full text-sm bg-input border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
              >
                <option value={100}>100 mm</option>
                <option value={150}>150 mm</option>
                <option value={200}>200 mm</option>
                <option value={250}>250 mm</option>
              </select>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setCovingOpen(false)}
              className="flex-1 text-xs border border-border rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCoving}
              disabled={!covFormLm}
              className="flex-1 text-xs bg-primary text-primary-foreground rounded px-3 py-2 font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <td className="text-center text-[10px] text-muted-foreground/60 select-none px-1 py-0">
        {index}
      </td>

      <td className="border-r border-border p-0">
        <input
          value={local.finish_code ?? ""}
          onChange={(e) => { set("finish_code", e.target.value); schedule({ finish_code: e.target.value || null }); }}
          onBlur={(e) => flush({ finish_code: e.target.value.trim() || null })}
          className={cellMono}
          placeholder="RF-01"
        />
      </td>

      <td className="border-r border-border p-0">
        <div className="flex items-center gap-1 px-2 py-1 min-w-0">
          {/* Manufacturer badge */}
          {editingBrand ? (
            <input
              autoFocus
              value={local.manufacturer ?? ""}
              onChange={e => { set("manufacturer", e.target.value || null); schedule({ manufacturer: e.target.value || null }); }}
              onBlur={e => { flush({ manufacturer: e.target.value.trim() || null }); setEditingBrand(false); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
              className="w-20 shrink-0 text-[10px] bg-input border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="Brand"
            />
          ) : (
            <button
              onClick={() => setEditingBrand(true)}
              title="Set manufacturer"
              className="shrink-0"
            >
              {hue !== null && local.manufacturer ? (
                <span
                  className="brand-badge px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  style={{ "--brand-hue": hue } as React.CSSProperties}
                >
                  {local.manufacturer}
                </span>
              ) : (
                <span className="text-[10px] text-tertiary/45 hover:text-tertiary/70 transition-colors px-0.5">Mfr</span>
              )}
            </button>
          )}

          <input
            value={local.description ?? ""}
            onChange={(e) => { set("description", e.target.value); schedule({ description: e.target.value || null }); }}
            onBlur={(e) => flush({ description: e.target.value.trim() || null })}
            className="flex-1 min-w-0 text-xs bg-transparent border-0 outline-none focus:ring-0 placeholder:text-muted-foreground/55 text-black dark:text-foreground/70"
            placeholder="Product name"
          />

          {/* Coving button / annotation — sheet only */}
          {isVinyl && !isPlankType && (
            hasCov ? (
              <span className="shrink-0 flex items-center gap-0 rounded-sm overflow-hidden font-mono text-[10px] bg-secondary/10">
                <button
                  onClick={openCovingForm}
                  className="text-secondary/70 hover:bg-secondary/20 px-1.5 py-0.5 transition-colors"
                >
                  +{(local.cov_area ?? 0).toFixed(1)}m² cov
                </button>
                <button
                  onClick={handleRemoveCoving}
                  title="Remove coving"
                  className="text-secondary/50 hover:text-destructive hover:bg-destructive/10 px-1 py-0.5 transition-colors"
                >
                  ×
                </button>
              </span>
            ) : (
              <button onClick={openCovingForm} className="shrink-0 text-[10px] text-secondary/45 hover:text-secondary/70 px-1 py-0.5 transition-colors">
                +cov
              </button>
            )
          )}

          {/* Weld rod restore — sheet only, shown when missing */}
          {isVinyl && !isPlankType && !hasWeldRod && (
            <button onClick={handleAddWeldRod} className="shrink-0 text-[10px] text-muted-foreground/45 hover:text-primary/60 px-1 py-0.5 transition-colors">
              +weld rod
            </button>
          )}
        </div>
      </td>

      <td className="border-r border-border p-0">
        <CalcInput
          value={r2(local.qty)}
          onCommit={(v) => { const newQty = r2(v); set("qty", newQty); flush({ qty: newQty }); }}
          className={cellRight}
          placeholder="0.00"
        />
      </td>

      <td className="border-r border-border p-0">
        <select
          value={local.unit}
          onChange={(e) => { set("unit", e.target.value); flush({ unit: e.target.value }); }}
          className={selectCell}
        >
          <option value="m2">m²</option>
          <option value="lm">lm</option>
          <option value="blm">blm</option>
          <option value="ea">ea</option>
        </select>
      </td>

      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.waste_pct === 0 ? "" : r2(local.waste_pct)}
          onChange={(e) => { const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); set("waste_pct", v); schedule({ waste_pct: v }); }}
          onBlur={(e) => { const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); set("waste_pct", v); flush({ waste_pct: v }); }}
          className={cn(cellRight, "!text-muted-foreground/60 dark:!text-foreground/70")}
          placeholder="0"
          min={0}
          max={100}
          step={1}
        />
      </td>

      <td className="border-r border-border p-0">
        <CalcInput
          value={r2(effQty)}
          onCommit={(v) => {
            const divisor = 1 + local.waste_pct / 100;
            const newQty = r2(Math.max(0, v / divisor - (local.cov_area ?? 0)));
            set("qty", newQty);
            flush({ qty: newQty });
          }}
          className={cn(cellRight, "text-secondary/80")}
          placeholder="0.00"
        />
      </td>

      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.mat_rate === 0 ? "" : r2(local.mat_rate)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("mat_rate", v); schedule({ mat_rate: v }); }}
          onBlur={(e) => { const v = parseFloat(e.target.value) || 0; set("mat_rate", v); flush({ mat_rate: v }); }}
          className={cellRight}
          placeholder="0.00"
          min={0}
          step={0.01}
        />
        {confirmedPrice != null && confirmedPrice !== r2(local.mat_rate) && (
          <button
            onClick={() => { set("mat_rate", confirmedPrice); flush({ mat_rate: confirmedPrice }); }}
            title="Apply confirmed supplier price"
            className="block w-full text-[9px] tabular-nums py-0.5 pr-2 text-right bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors leading-none"
          >
            ↑ ${confirmedPrice.toFixed(2)}
          </button>
        )}
      </td>

      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.lab_rate === 0 ? "" : r2(local.lab_rate)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("lab_rate", v); schedule({ lab_rate: v }); }}
          onBlur={(e) => { const v = parseFloat(e.target.value) || 0; set("lab_rate", v); flush({ lab_rate: v }); }}
          className={cellRight}
          placeholder="0.00"
          min={0}
          step={0.01}
        />
      </td>

      <td className="border-r border-border p-0">
        <div className={readonlyCell}>{matCost > 0 ? `$${fmt(matCost)}` : "—"}</div>
      </td>

      <td className="border-r border-border p-0">
        <div className={readonlyCell}>{labCost > 0 ? `$${fmt(labCost)}` : "—"}</div>
      </td>

      <td className="border-r border-border p-0">
        <div className={cn(readonlyCell, "font-semibold text-black dark:text-foreground/75")}>
          {total > 0 ? `$${fmt(total)}` : "—"}
        </div>
      </td>

      <td className="w-7 text-center p-0">
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Consumable row ────────────────────────────────────────────────────────────
function ConsumableRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: EstimateItem;
  onUpdate: (id: string, patch: Partial<EstimateItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(item);
  const pending = useRef<Partial<EstimateItem>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal((prev) => ({ ...prev, ...item }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Auto-managed consumables: keep qty in sync when parent row qty drives a recalculation
  useEffect(() => {
    if (item.is_auto) setLocal((prev) => ({ ...prev, qty: item.qty }));
  }, [item.is_auto, item.qty]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = useCallback(
    (patch: Partial<EstimateItem>) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onUpdate(item.id, pending.current);
        pending.current = {};
        timer.current = null;
      }, 600);
    },
    [item.id, onUpdate]
  );

  const flush = useCallback(
    (patch: Partial<EstimateItem>) => {
      const full = { ...pending.current, ...patch };
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      pending.current = {};
      if (Object.keys(full).length > 0) onUpdate(item.id, full);
    },
    [item.id, onUpdate]
  );

  const set = (field: keyof EstimateItem, value: unknown) =>
    setLocal((prev) => ({ ...prev, [field]: value }));

  const matCost = itemMatCost(local);
  const labCost = itemLabCost(local);
  const total = itemTotal(local);

  return (
    <tr className="border-b border-border hover:bg-muted/10 group">
      {/* # */}
      <td className="text-center text-[10px] text-muted-foreground/60 select-none px-1 py-0">
        ↳
      </td>

      {/* Code — not applicable */}
      <td className="border-r border-border p-0">
        <span className={dimCell}>—</span>
      </td>

      {/* Description */}
      <td className="border-r border-border p-0 pl-3">
        <input
          value={local.description ?? ""}
          onChange={(e) => { set("description", e.target.value); schedule({ description: e.target.value || null }); }}
          onBlur={(e) => flush({ description: e.target.value.trim() || null })}
          className={cn(cell, "text-foreground/55 pl-0")}
          placeholder="Description"
        />
      </td>

      {/* Qty */}
      <td className="border-r border-border p-0">
        <CalcInput
          value={local.qty}
          onCommit={(v) => { set("qty", v); flush({ qty: v }); }}
          className={cn(cellRight, "text-foreground/55")}
          placeholder="0"
        />
      </td>

      {/* Unit */}
      <td className="border-r border-border p-0">
        <select
          value={local.unit}
          onChange={(e) => { set("unit", e.target.value); flush({ unit: e.target.value }); }}
          className={cn(selectCell, "text-foreground/55")}
        >
          <option value="m2">m²</option>
          <option value="lm">lm</option>
          <option value="ea">ea</option>
          <option value="drum">drum</option>
          <option value="bag">bag</option>
          <option value="coil">coil</option>
        </select>
      </td>

      {/* Waste% — not used */}
      <td className="border-r border-border p-0">
        <span className={dimCell}>—</span>
      </td>

      {/* Eff. Qty — same as qty for consumables */}
      <td className="border-r border-border p-0 bg-primary/5 overflow-hidden">
        <div className={cn(readonlyCell, "text-secondary/60 whitespace-nowrap")}>
          {local.qty > 0 ? `${local.qty} ${uLabel(local.unit)}` : "—"}
          {local.coverage_m2 && (
            <span className="ml-1 text-[9px] text-muted-foreground/45">/{local.coverage_m2}m²</span>
          )}
        </div>
      </td>

      {/* Mat $/u */}
      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.mat_rate === 0 ? "" : r2(local.mat_rate)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("mat_rate", v); schedule({ mat_rate: v }); }}
          onBlur={(e) => { const v = parseFloat(e.target.value) || 0; set("mat_rate", v); flush({ mat_rate: v }); }}
          className={cn(cellRight, "text-foreground/55")}
          placeholder="0.00"
          min={0}
          step={0.01}
        />
      </td>

      {/* Lab $/u */}
      <td className="border-r border-border p-0">
        <input
          type="number"
          value={local.lab_rate === 0 ? "" : r2(local.lab_rate)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("lab_rate", v); schedule({ lab_rate: v }); }}
          onBlur={(e) => { const v = parseFloat(e.target.value) || 0; set("lab_rate", v); flush({ lab_rate: v }); }}
          className={cn(cellRight, "text-foreground/55")}
          placeholder="0.00"
          min={0}
          step={0.01}
        />
      </td>

      {/* Mat $ */}
      <td className="border-r border-border p-0">
        <div className={cn(readonlyCell, "text-foreground/55")}>{matCost > 0 ? `$${fmt(matCost)}` : "—"}</div>
      </td>

      {/* Lab $ */}
      <td className="border-r border-border p-0">
        <div className={cn(readonlyCell, "text-foreground/55")}>{labCost > 0 ? `$${fmt(labCost)}` : "—"}</div>
      </td>

      {/* Total */}
      <td className="border-r border-border p-0">
        <div className={cn(readonlyCell, "text-foreground/55")}>{total > 0 ? `$${fmt(total)}` : "—"}</div>
      </td>

      {/* Delete */}
      <td className="w-7 text-center p-0">
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Add section row ───────────────────────────────────────────────────────────
function AddSectionRow({
  usedCategories,
  onAdd,
}: {
  usedCategories: Set<string>;
  onAdd: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = CATEGORIES.filter((c) => !usedCategories.has(c.key));

  if (available.length === 0) return null;

  return (
    <tr className="border-t border-border">
      <td colSpan={13} className="px-3 py-2">
        {open ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">Add section:</span>
            {available.map((cat) => (
              <button
                key={cat.key}
                onClick={() => { onAdd(cat.key); setOpen(false); }}
                className="text-[11px] px-2.5 py-1 rounded border border-white/[0.12] text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                {cat.label}
              </button>
            ))}
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground/45 hover:text-muted-foreground transition-colors ml-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/45 hover:text-primary transition-colors py-0.5"
          >
            <Plus className="h-2.5 w-2.5" />
            Add section
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CostingTable({
  estimate,
  initialItems,
  initialWetAreas,
  takeoffs,
  orgSlug,
  projectId,
  confirmedPrices = {},
}: {
  estimate: Estimate;
  initialItems: EstimateItem[];
  initialWetAreas: WetArea[];
  takeoffs: { id: string; name: string }[];
  orgSlug: string;
  projectId: string;
  confirmedPrices?: Record<string, number>;
}) {
  const [items, setItems] = useState<EstimateItem[]>(initialItems);
  const [wetAreas, setWetAreas] = useState<WetArea[]>(initialWetAreas);
  const [includeWetAreas, setIncludeWetAreas] = useState(true);
  const [includeFloorPrep, setIncludeFloorPrep] = useState(true);
  const [includeGrind, setIncludeGrind] = useState(true);
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  const toggleCategory = useCallback((key: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  const [settings, setSettings] = useState<EstimateSettings>({
    accounting_rate: estimate.accounting_rate,
    admin_rate: estimate.admin_rate,
    net_markup_pct: estimate.net_markup_pct,
    freight: estimate.freight,
    accommodation: estimate.accommodation,
    travel_allowance: estimate.travel_allowance,
    bailing_fee: estimate.bailing_fee,
    floor_prep_area: estimate.floor_prep_area ?? 0,
    floor_prep_depth_mm: estimate.floor_prep_depth_mm ?? 3,
    floor_prep_charge_per_bag: estimate.floor_prep_charge_per_bag ?? 0,
    floor_prep_mat_per_bag: estimate.floor_prep_mat_per_bag ?? 33,
    floor_prep_lab_per_bag: estimate.floor_prep_lab_per_bag ?? 40,
    grind_area: estimate.grind_area ?? 0,
    grind_labor_rate: estimate.grind_labor_rate ?? 0,
    grind_charge_rate: estimate.grind_charge_rate ?? 0,
  });
  const [importing, setImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Column resize
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState(INIT_WIDTHS);
  const colWidthsRef = useRef(INIT_WIDTHS);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const available = el.clientWidth;
    const base = INIT_WIDTHS.reduce((s, w) => s + w, 0);
    if (available <= base) return;
    const next = [...INIT_WIDTHS];
    next[2] += available - base; // description col absorbs extra
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

  const markSaving = () => {
    setSaveStatus("saving");
    if (statusTimer.current) clearTimeout(statusTimer.current);
  };
  const markSaved = () => {
    setSaveStatus("saved");
    statusTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
  };

  const updateItem = useCallback(
    (id: string, patch: Partial<EstimateItem>) => {
      setItems((prev) => {
        const updated = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        if ("qty" in patch) {
          const item = prev.find((i) => i.id === id);
          if (item && !item.parent_item_id) {
            const newQty = patch.qty as number;
            // Recompute per-item auto children
            const withChildren = updated.map((i) =>
              i.parent_item_id === id && i.is_auto ? { ...i, qty: calcAutoChildQty(i, newQty) } : i
            );
            // Also recompute section consumables if this is a vinyl primary
            if (VINYL_SCOPES.has(item.scope_category)) {
              return applySectionConsumableQtys(withChildren, item.scope_category);
            }
            return withChildren;
          }
        }
        return updated;
      });

      if ("qty" in patch) {
        const item = items.find((i) => i.id === id);
        if (item && !item.parent_item_id) {
          syncAutoConsumables(id, patch.qty as number).catch(() => {});
          if (VINYL_SCOPES.has(item.scope_category)) {
            const scope = item.scope_category;
            const primaries = items
              .map(i => i.id === id ? { ...i, qty: patch.qty as number } : i)
              .filter(i => i.scope_category === scope && i.type === "primary" && !i.parent_item_id);
            const totalArea   = primaries.reduce((s, p) => s + (Number(p.qty) || 0), 0);
            const gluableArea = primaries.filter(p => p.product_type !== "plank_floating").reduce((s, p) => s + (Number(p.qty) || 0), 0);
            // If section consumables exist, update only those rows — never recreate manually deleted ones
            const sectionRows = items.filter(i => i.scope_category === scope && i.is_auto && !i.parent_item_id && i.type === "consumable");
            if (sectionRows.length > 0) {
              for (const sc of sectionRows) {
                let qty: number | null = null;
                if (sc.description === "Feather Finish 20kg")  qty = totalArea > 0 ? Math.ceil(totalArea / COVERAGE_M2) : 0;
                if (sc.description === "Feather Finish Labour") qty = totalArea;
                if (sc.description === "Glue Sheet/Plank")     qty = gluableArea > 0 ? Math.ceil(gluableArea / COVERAGE_M2) : 0;
                if (qty !== null) updateEstimateItem(sc.id, { qty }).catch(() => {});
              }
            } else {
              // No section rows exist yet (first qty entry) — create them
              syncSectionConsumables(estimate.id, scope, totalArea, gluableArea)
                .then(rows => { if (rows.length > 0) setItems(prev => [...prev, ...rows]); })
                .catch(() => {});
            }
          }
        }
      }
      markSaving();
      updateEstimateItem(id, patch).then(markSaved).catch(() => toast.error("Save failed."));
    },
    [items, estimate.id]
  );

  const deleteItem = useCallback((id: string) => {
    const deletedItem = items.find(i => i.id === id);
    setItems((prev) => {
      const toRemove = new Set<string>();
      toRemove.add(id);
      prev.forEach((i) => { if (i.parent_item_id && toRemove.has(i.parent_item_id)) toRemove.add(i.id); });
      const after = prev.filter((i) => !toRemove.has(i.id));
      // Recompute section consumables optimistically if deleting a vinyl primary
      if (deletedItem && deletedItem.type === "primary" && !deletedItem.parent_item_id && VINYL_SCOPES.has(deletedItem.scope_category)) {
        return applySectionConsumableQtys(after, deletedItem.scope_category);
      }
      return after;
    });
    deleteEstimateItem(id).catch(() => toast.error("Delete failed."));
    // Resync section consumables in DB — only when a primary row is deleted, not a section consumable
    if (deletedItem && deletedItem.type === "primary" && !deletedItem.parent_item_id && VINYL_SCOPES.has(deletedItem.scope_category)) {
      const scope = deletedItem.scope_category;
      const remaining = items.filter(i => i.id !== id && i.scope_category === scope && i.type === "primary" && !i.parent_item_id);
      const totalArea   = remaining.reduce((s, p) => s + (Number(p.qty) || 0), 0);
      const gluableArea = remaining.filter(p => p.product_type !== "plank_floating").reduce((s, p) => s + (Number(p.qty) || 0), 0);
      syncSectionConsumables(estimate.id, scope, totalArea, gluableArea).catch(() => {});
    }
  }, [items, estimate.id]);

  const handleCovingAdded = useCallback((primaryId: string, newChildren: EstimateItem[], covLm: number, covArea: number, covHeightMm: number) => {
    setItems((prev) => {
      const withoutOldCoving = prev.filter(
        (i) => !(i.parent_item_id === primaryId && COVING_DESCS.has(i.description ?? ""))
      );
      return withoutOldCoving.map((i) =>
        i.id === primaryId ? { ...i, cov_lm: covLm, cov_area: covArea, cov_height_mm: covHeightMm } : i
      ).concat(newChildren);
    });
  }, []);

  const handleCovingRemoved = useCallback((primaryId: string) => {
    setItems((prev) =>
      prev
        .filter((i) => !(i.parent_item_id === primaryId && COVING_DESCS.has(i.description ?? "")))
        .map((i) => i.id === primaryId ? { ...i, cov_lm: null, cov_area: null, cov_height_mm: null } : i)
    );
  }, []);

  const addRow = useCallback(
    async (scopeCategory: string) => {
      const inScope = items.filter((i) => i.scope_category === scopeCategory);
      const nextOrder = inScope.length ? Math.max(...inScope.map((i) => i.sort_order)) + 1 : 0;
      try {
        const { primary, children } = await addEstimateItem(estimate.id, scopeCategory, nextOrder);
        setItems((prev) => [...prev, primary, ...children]);
        // For vinyl, ensure section consumable rows exist (created on first non-zero qty, but scaffold them now)
        if (VINYL_SCOPES.has(scopeCategory)) {
          const allPrimaries = [...items, primary].filter(i => i.scope_category === scopeCategory && i.type === "primary" && !i.parent_item_id);
          const totalArea   = allPrimaries.reduce((s, p) => s + (Number(p.qty) || 0), 0);
          const gluableArea = allPrimaries.filter(p => p.product_type !== "plank_floating").reduce((s, p) => s + (Number(p.qty) || 0), 0);
          const rows = await syncSectionConsumables(estimate.id, scopeCategory, totalArea, gluableArea);
          if (rows.length > 0) {
            setItems(prev => {
              const existingIds = new Set(prev.map(i => i.id));
              const newOnes = rows.filter(r => !existingIds.has(r.id));
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
          }
        }
      } catch {
        toast.error("Failed to add row.");
      }
    },
    [items, estimate.id]
  );

  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateSettings = useCallback(
    (patch: Partial<EstimateSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      markSaving();
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => {
        updateEstimateSettings(estimate.id, patch).then(markSaved).catch(() => toast.error("Save failed."));
      }, 600);
    },
    [estimate.id]
  );

  const resetFloorPrep = useCallback(async () => {
    setSettings((prev) => ({ ...prev, ...FLOOR_PREP_DEFAULTS }));
    if (settingsTimer.current) { clearTimeout(settingsTimer.current); settingsTimer.current = null; }
    markSaving();
    updateEstimateSettings(estimate.id, FLOOR_PREP_DEFAULTS).then(markSaved).catch(() => toast.error("Save failed."));
  }, [estimate.id]);

  const handleImport = async (takeoffId: string) => {
    setImporting(true);
    try {
      await importTakeoff(estimate.id, takeoffId, orgSlug, projectId);
      // Reload items — simplest approach is page refresh
      window.location.reload();
    } catch {
      toast.error("Import failed.");
      setImporting(false);
    }
  };

  // Distinct levels present in primary items, sorted by LEVELS order
  const levels = useMemo(() => {
    const set = new Set(items.filter(i => !i.parent_item_id && i.level).map(i => i.level as string));
    return LEVELS.filter(l => set.has(l));
  }, [items]);

  // Items visible under the current level selection
  const filteredItems = useMemo(() => {
    if (selectedLevel === "all" || levels.length < 2) return items;
    const visibleIds = new Set(
      items.filter(i => !i.parent_item_id && i.level === selectedLevel).map(i => i.id)
    );
    return items.filter(i =>
      i.parent_item_id
        ? visibleIds.has(i.parent_item_id)
        : i.level === selectedLevel || (!i.parent_item_id && i.is_auto && i.type === "consumable")
    );
  }, [items, selectedLevel, levels]);

  const activeItems = useMemo(
    () => filteredItems.filter((i) => !excludedCategories.has(i.scope_category)),
    [filteredItems, excludedCategories],
  );

  // Group items: primaries, per-item children, and section-level consumables
  const grouped = useMemo(() => {
    const children = new Map<string, EstimateItem[]>();
    const sectionConsumables = new Map<string, EstimateItem[]>();
    const primaries: EstimateItem[] = [];
    filteredItems.forEach((item) => {
      if (item.parent_item_id) {
        const arr = children.get(item.parent_item_id) ?? [];
        arr.push(item);
        children.set(item.parent_item_id, arr);
      } else if (!item.parent_item_id && item.is_auto && item.type === "consumable") {
        const arr = sectionConsumables.get(item.scope_category) ?? [];
        arr.push(item);
        sectionConsumables.set(item.scope_category, arr);
      } else {
        primaries.push(item);
      }
    });
    return { primaries, children, sectionConsumables };
  }, [filteredItems]);

  const effectiveSettings = useMemo(
    () => ({
      ...settings,
      floor_prep_area: includeFloorPrep ? settings.floor_prep_area : 0,
      grind_area: includeGrind ? settings.grind_area : 0,
    }),
    [settings, includeFloorPrep, includeGrind],
  );

  const summary = useMemo(
    () => computeSummary(activeItems, effectiveSettings, includeWetAreas ? wetAreas : []),
    [activeItems, effectiveSettings, wetAreas, includeWetAreas],
  );

  // Category totals: primary rows + their children + section consumables
  const catTotals = useMemo(() => {
    const map: Record<string, { mat: number; lab: number; total: number }> = {};
    grouped.primaries.forEach((item) => {
      const children = grouped.children.get(item.id) ?? [];
      const mat = itemMatCost(item) + children.reduce((s, c) => s + itemMatCost(c), 0);
      const lab = itemLabCost(item) + children.reduce((s, c) => s + itemLabCost(c), 0);
      const entry = map[item.scope_category] ?? { mat: 0, lab: 0, total: 0 };
      entry.mat += mat; entry.lab += lab; entry.total += mat + lab;
      map[item.scope_category] = entry;
    });
    grouped.sectionConsumables.forEach((scs, scope) => {
      scs.forEach((sc) => {
        const entry = map[scope] ?? { mat: 0, lab: 0, total: 0 };
        entry.mat += itemMatCost(sc); entry.lab += itemLabCost(sc); entry.total += itemMatCost(sc) + itemLabCost(sc);
        map[scope] = entry;
      });
    });
    return map;
  }, [grouped]);

  const tableTotals = useMemo(() => {
    const mat = activeItems.reduce((s, i) => s + itemMatCost(i), 0);
    const lab = activeItems.reduce((s, i) => s + itemLabCost(i), 0);
    return { mat, lab, total: mat + lab };
  }, [activeItems]);

  // Mirrors report-document: primaries + parent-attached children only, no section consumables.
  // Excludes toggled-off categories so per-unit badges and grand total stay consistent.
  const reportCatTotals = useMemo(() => {
    const map: Record<string, number> = {};
    grouped.primaries
      .filter((p) => !excludedCategories.has(p.scope_category))
      .forEach((p) => {
        const ch = grouped.children.get(p.id) ?? [];
        const cost = itemMatCost(p) + itemLabCost(p) + ch.reduce((s, c) => s + itemMatCost(c) + itemLabCost(c), 0);
        map[p.scope_category] = (map[p.scope_category] ?? 0) + cost;
      });
    return map;
  }, [grouped, excludedCategories]);

  const reportItemsGrandTotal = useMemo(
    () => Object.values(reportCatTotals).reduce((s, v) => s + v, 0),
    [reportCatTotals],
  );

  const grossMarginPct = summary.grossMarginPct;
  const markupWarning = grossMarginPct < 0.18;

  const markupBadgeCls = settings.net_markup_pct >= 0.333
    ? "bg-success/15 text-success border-success/30"
    : settings.net_markup_pct >= 0.176
    ? "bg-warning/15 text-warning border-warning/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

  const markupTextCls = settings.net_markup_pct >= 0.333
    ? "text-success"
    : settings.net_markup_pct >= 0.176
    ? "text-warning"
    : "text-destructive";

  return (
    <div className="space-y-4">
      {/* ── Rate settings bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-card/65 backdrop-blur-xl border border-border rounded-sm px-4 py-2.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
          Rates
        </span>

        {(
          [
            ["Accounting", "accounting_rate"],
            ["Admin", "admin_rate"],
          ] as [string, keyof EstimateSettings][]
        ).map(([label, key]) => (
          <label key={key} className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="number"
              value={r2(Number(settings[key]) * 100)}
              onChange={(e) =>
                updateSettings({ [key]: (parseFloat(e.target.value) || 0) / 100 } as Partial<EstimateSettings>)
              }
              className="w-12 text-xs text-right tabular-nums bg-input border border-border rounded px-1.5 py-0.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
              min={0}
              max={100}
              step={0.5}
            />
            <span className="text-muted-foreground">%</span>
          </label>
        ))}

        <label className="flex items-center gap-1.5 text-xs">
          <span className={markupWarning ? "text-warning" : "text-muted-foreground"}>Mark-up</span>
          <input
            type="number"
            value={r2(Number(settings.net_markup_pct) * 100)}
            onChange={(e) =>
              updateSettings({ net_markup_pct: (parseFloat(e.target.value) || 0) / 100 })
            }
            className={cn(
              "w-14 text-xs text-right tabular-nums bg-input border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/40",
              markupWarning ? "border-warning/50 text-warning" : "border-border text-foreground/70"
            )}
            min={0}
            max={100}
            step={0.5}
          />
          <span className="text-muted-foreground">%</span>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tabular-nums border", markupBadgeCls)}>
            {fmtPct(settings.net_markup_pct)}%
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold tabular-nums border",
            markupWarning
              ? "bg-warning/15 text-warning border-warning/30"
              : grossMarginPct >= 0.25
              ? "bg-success/15 text-success border-success/30"
              : "bg-primary/15 text-primary border-primary/30"
          )}>
            GP {fmtPct(grossMarginPct)}%
          </span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[10px] text-success">Saved</span>
          )}

          {/* Import / re-import from takeoff */}
          {takeoffs.length > 0 && (
            <button
              disabled={importing}
              onClick={() => {
                const takeoffId = estimate.source_takeoff_id ?? takeoffs[0]?.id;
                if (takeoffId) handleImport(takeoffId);
              }}
              className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary border border-primary/30 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", importing && "animate-spin")} />
              {items.length === 0 ? "Import" : "Re-import"}
            </button>
          )}
        </div>
      </div>

      {/* ── Line items table ───────────────────────────────────────────────── */}
      <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
        {/* Level filter strip — only shown when estimate has multiple levels */}
        {levels.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/15">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
              Level
            </span>
            {(["all", ...levels] as string[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={cn(
                  "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors",
                  selectedLevel === lvl
                    ? "bg-primary/90 text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {lvl === "all" ? "All" : lvl}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-x-auto" ref={tableWrapRef}>
          <table
            className="border-collapse"
            style={{ width: colWidths.reduce((s, w) => s + w, 0), tableLayout: "fixed" }}
          >
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>

            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {(
                  [
                    ["#",         "text-center"],
                    ["Code",      "text-left"],
                    ["Description","text-left"],
                    ["Qty",       "text-right"],
                    ["Unit",      "text-left"],
                    ["Waste%",    "text-right"],
                    ["Eff. Qty",  "text-right"],
                    ["Mat $/u",   "text-right"],
                    ["Lab $/u",   "text-right"],
                    ["Mat $",     "text-right"],
                    ["Lab $",     "text-right"],
                    ["Total",     "text-right"],
                    ["",          ""],
                  ] as [string, string][]
                ).map(([label, align], i, arr) => (
                  <th
                    key={i}
                    className={cn(
                      "px-2 py-1 text-[9px] font-medium text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0 relative overflow-hidden select-none",
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
                const catPrimaries = grouped.primaries
                  .filter((i) => i.scope_category === cat.key)
                  .sort((a, b) => a.sort_order - b.sort_order);

                if (catPrimaries.length === 0) return null;

                const catTotal = catTotals[cat.key] ?? { mat: 0, lab: 0, total: 0 };
                const netQty    = catPrimaries.reduce((s, i) => s + (Number(i.qty) || 0), 0);
                const supplyQty = catPrimaries.reduce((s, i) => s + (itemMatQty(i) || 0), 0);
                const catUnit   = catPrimaries.length > 0 ? uLabel(catPrimaries[0].unit) : "m²";
                // Per-unit sell rate — mirrors report-document exactly
                const unitCounts: Record<string, number> = {};
                catPrimaries.forEach((p) => { unitCounts[p.unit] = (unitCounts[p.unit] ?? 0) + 1; });
                const primaryUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "m2";
                const grossQty = catPrimaries.filter((p) => p.unit === primaryUnit).reduce((s, p) => s + itemMatQty(p), 0);
                const catPrimaryTotal = reportCatTotals[cat.key] ?? 0;
                const catShare = reportItemsGrandTotal > 0 ? catPrimaryTotal / reportItemsGrandTotal : 0;
                const perUnit = grossQty > 0 ? (catShare * (summary.totalExGst - summary.floorPrepRevenue)) / grossQty : 0;

                const isExcluded = excludedCategories.has(cat.key);

                return (
                  <React.Fragment key={cat.key}>
                    {/* Section header */}
                    <tr className={cn("border-y border-border", isExcluded ? "bg-muted/10" : "bg-muted/30")}>
                      <td colSpan={13} className="px-3 py-1.5">
                        <div className={cn("flex items-center justify-between", isExcluded && "opacity-50")}>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!isExcluded}
                              onCheckedChange={() => toggleCategory(cat.key)}
                              className="scale-75 origin-left"
                            />
                            <div className="w-0.5 h-3 rounded-full bg-primary/50" />
                            <span className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-widest", isExcluded && "line-through")}>
                              {cat.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-5">
                            {netQty > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                                <span className="text-muted-foreground">net</span>
                                <span className="text-foreground/70">{fmt(netQty)}</span>
                                <span className="text-muted-foreground/45">→</span>
                                <span className="text-muted-foreground">supply</span>
                                <span className="text-primary font-medium">{fmt(supplyQty)}</span>
                                <span className="text-muted-foreground">{catUnit}</span>
                              </div>
                            )}
                            {catTotal.total > 0 && (
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                                  Mat <span className="text-foreground/55 font-medium">${fmt(catTotal.mat)}</span>
                                </span>
                                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                                  Lab <span className="text-foreground/55 font-medium">${fmt(catTotal.lab)}</span>
                                </span>
                                <span className="text-[11px] tabular-nums text-foreground/75 font-semibold">
                                  ${fmt(catTotal.total)}
                                </span>
                              </div>
                            )}
                            {perUnit > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-primary/10 text-primary border border-primary/20">
                                ${fmt(perUnit)}<span className="font-normal opacity-70">/ {catUnit}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {catPrimaries.map((item, idx) => {
                      const itemChildren = (grouped.children.get(item.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
                      const groupMat = itemMatCost(item) + itemChildren.reduce((s, c) => s + itemMatCost(c), 0);
                      const groupLab = itemLabCost(item) + itemChildren.reduce((s, c) => s + itemLabCost(c), 0);
                      const itemLabel = item.finish_code || item.description || `#${idx + 1}`;
                      const hasWeldRod = itemChildren.some((c) => c.description === "Weld Rod");
                      return (
                        <React.Fragment key={item.id}>
                          <PrimaryRow
                            item={item}
                            index={idx + 1}
                            estimateId={estimate.id}
                            onUpdate={updateItem}
                            onDelete={deleteItem}
                            onCovingAdded={handleCovingAdded}
                            onCovingRemoved={handleCovingRemoved}
                            hasWeldRod={hasWeldRod}
                            onConsumableAdded={(newItems) => setItems((prev) => [...prev, ...newItems])}
                            confirmedPrice={item.finish_code ? confirmedPrices[item.finish_code] : undefined}
                          />
                          {itemChildren.map((child) => (
                            <ConsumableRow
                              key={child.id}
                              item={child}
                              onUpdate={updateItem}
                              onDelete={deleteItem}
                            />
                          ))}
                          {itemChildren.length > 0 && (
                            <SubtotalRow label={itemLabel} matCost={groupMat} labCost={groupLab} total={groupMat + groupLab} />
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Section-level consumables (FF + Glue consolidated across all items) */}
                    {(() => {
                      const sectionRows = (grouped.sectionConsumables.get(cat.key) ?? [])
                        .sort((a, b) => a.sort_order - b.sort_order);
                      if (sectionRows.length === 0) return null;
                      return (
                        <>
                          <tr className="bg-muted/10 border-t border-black/10 dark:border-white/10">
                            <td colSpan={13} className="px-3 py-1">
                              <div className="flex items-center gap-2">
                                <div className="w-px h-3 rounded-full bg-muted-foreground/30" />
                                <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest select-none">
                                  Section Prep
                                </span>
                                <span className="text-[9px] text-muted-foreground/45 select-none">
                                  — consolidated across all {cat.label.toLowerCase()} items
                                </span>
                              </div>
                            </td>
                          </tr>
                          {sectionRows.map((child) => (
                            <ConsumableRow
                              key={child.id}
                              item={child}
                              onUpdate={updateItem}
                              onDelete={deleteItem}
                            />
                          ))}
                        </>
                      );
                    })()}

                    <tr>
                      <td colSpan={13} className="px-3 py-1">
                        <button
                          onClick={() => addRow(cat.key)}
                          className="flex items-center gap-1 text-[11px] text-primary/50 hover:text-primary transition-colors py-0.5"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Add row
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Add section — shows unused categories */}
              <AddSectionRow
                usedCategories={new Set(grouped.primaries.map((i) => i.scope_category))}
                onAdd={addRow}
              />


              {items.length > 0 && (
                <tr className="bg-muted/25 border-t-2 border-border">
                  <td className="px-1 py-2.5" />
                  <td className="border-r border-border" />
                  <td colSpan={7} className="border-r border-border px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Total Cost
                  </td>
                  <td className="border-r border-border px-2 py-2.5 text-right text-[11px] tabular-nums font-semibold text-foreground/75">
                    ${fmt(tableTotals.mat)}
                  </td>
                  <td className="border-r border-border px-2 py-2.5 text-right text-[11px] tabular-nums font-semibold text-foreground/75">
                    ${fmt(tableTotals.lab)}
                  </td>
                  <td className="border-r border-border px-2 py-2.5 text-right text-[11px] tabular-nums font-bold text-foreground/75">
                    ${fmt(tableTotals.total)}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Additional costs ───────────────────────────────────────────────── */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
          Additional Costs
        </span>
        {(
          [
            ["Freight",       "freight"],
            ["Accommodation", "accommodation"],
            ["Travel",        "travel_allowance"],
            ["Bailing Fee",   "bailing_fee"],
          ] as [string, keyof EstimateSettings][]
        ).map(([label, key]) => (
          <label key={key} className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-muted-foreground">$</span>
            <input
              type="number"
              value={Number(settings[key]) === 0 ? "" : r2(Number(settings[key]))}
              onChange={(e) =>
                updateSettings({ [key]: parseFloat(e.target.value) || 0 } as Partial<EstimateSettings>)
              }
              className="w-24 text-xs text-right tabular-nums bg-input border border-border rounded px-1.5 py-0.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="0.00"
              min={0}
              step={0.01}
            />
          </label>
        ))}
      </div>

      {/* ── Wet Areas ─────────────────────────────────────────────────────── */}
      <div className="space-y-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border border-border rounded-t-sm border-b-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Wet Areas
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={cn("text-[10px] tabular-nums", includeWetAreas ? "text-foreground/70" : "text-muted-foreground/50 line-through")}>
              Include in totals
            </span>
            <Switch
              checked={includeWetAreas}
              onCheckedChange={setIncludeWetAreas}
              className="scale-75 origin-right"
            />
          </label>
        </div>
        <WetAreasPanel
          estimateId={estimate.id}
          initialAreas={initialWetAreas}
          onChange={setWetAreas}
        />
      </div>

      {/* ── Summary + Floor Prep ───────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

      {/* Summary waterfall */}
      <div className="flex-1 min-w-0 bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Cost Summary
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Gross Margin</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded text-xs font-bold tabular-nums border",
              markupWarning
                ? "bg-warning/15 text-warning border-warning/30"
                : grossMarginPct >= 0.25
                ? "bg-success/15 text-success border-success/30"
                : "bg-primary/15 text-primary border-primary/30"
            )}>
              {fmtPct(grossMarginPct)}%
            </span>
          </div>
        </div>

        <table className="w-full">
          <tbody>
            <SummaryRow label="Materials" value={tableTotals.mat} />
            <SummaryRow
              label="Labour"
              value={tableTotals.lab + (summary.wetAreasCount > 0 ? summary.wetAreasProfit : 0)}
            />
            <tr className="bg-muted/10 border-b border-border">
              <td className="pl-9 pr-4 py-1.5 text-xs text-muted-foreground/45">
                Accounting ({fmtPct(settings.accounting_rate)}%)
              </td>
              <td className="px-4 py-1.5 text-xs text-right tabular-nums text-muted-foreground/45">
                ${fmt(summary.accountingCost)}
              </td>
            </tr>
            <tr className="bg-muted/10 border-b border-border">
              <td className="pl-9 pr-4 py-1.5 text-xs text-muted-foreground/45">
                Admin ({fmtPct(settings.admin_rate)}%)
              </td>
              <td className="px-4 py-1.5 text-xs text-right tabular-nums text-muted-foreground/45">
                ${fmt(summary.adminCost)}
              </td>
            </tr>
            <SummaryRow label="Subtotal after Overheads" value={summary.subtotalAfterOverhead} subtotal />
            <tr className={cn(
              "border-b border-border",
              markupWarning ? "bg-warning/[0.07]" : "bg-secondary/[0.07]"
            )}>
              <td colSpan={2} className="px-4 pt-3 pb-2.5">
                {/* Label row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", markupWarning ? "text-warning" : "text-muted-foreground")}>
                      Mark-up
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold border tabular-nums", markupBadgeCls)}>
                      {fmtPct(settings.net_markup_pct)}%
                    </span>
                  </div>
                  <span className={cn("tabular-nums font-bold text-base", markupTextCls)}>
                    ${fmt(summary.markupAmount)}
                  </span>
                </div>
                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={r2(Number(settings.net_markup_pct) * 100)}
                  onChange={(e) => updateSettings({ net_markup_pct: parseFloat(e.target.value) / 100 })}
                  className={cn(
                    "w-full mt-2.5 h-1 rounded-full cursor-pointer appearance-none",
                    "bg-border [&::-webkit-slider-thumb]:appearance-none",
                    "[&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5",
                    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer",
                    "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125",
                    markupWarning
                      ? "[&::-webkit-slider-thumb]:bg-warning"
                      : "[&::-webkit-slider-thumb]:bg-secondary"
                  )}
                />
                <div className="flex justify-between mt-1">
                  <span className={cn("text-[9px]", markupWarning ? "text-warning/55" : "text-secondary/55")}>0%</span>
                  <span className={cn("text-[9px]", markupWarning ? "text-warning/55" : "text-secondary/55")}>100%</span>
                </div>
              </td>
            </tr>
            {summary.floorPrepBags > 0 && (
              <tr className="bg-muted/10 border-b border-border">
                <td className="pl-9 pr-4 py-1.5 text-xs text-muted-foreground/45">
                  Floor Prep profit ({summary.floorPrepBags} bags)
                </td>
                <td className="px-4 py-1.5 text-xs text-right tabular-nums text-success/80">
                  +${fmt(summary.floorPrepProfit)}
                </td>
              </tr>
            )}
            {summary.grindProfit !== 0 && effectiveSettings.grind_area > 0 && (
              <tr className="bg-muted/10 border-b border-border">
                <td className="pl-9 pr-4 py-1.5 text-xs text-muted-foreground/45">
                  Grinding profit ({fmt(settings.grind_area)} m²)
                </td>
                <td className={cn("px-4 py-1.5 text-xs text-right tabular-nums", summary.grindProfit >= 0 ? "text-success/80" : "text-destructive/80")}>
                  {summary.grindProfit >= 0 ? "+" : ""}${fmt(summary.grindProfit)}
                </td>
              </tr>
            )}
            <SummaryRow label="Subtotal after Mark-up" value={summary.subtotalAfterMarkup} subtotal />
            <SummaryRow label="Additional Costs" value={summary.additionalCosts} />
            {summary.floorPrepBags > 0 && (
              <SummaryRow label={`Floor Prep material & labour (${summary.floorPrepBags} bags)`} value={summary.floorPrepCost} />
            )}
            {effectiveSettings.grind_area > 0 && (
              <SummaryRow label={`Grinding labour (${fmt(settings.grind_area)} m²)`} value={summary.grindCost} />
            )}
            <SummaryRow label="Total ex-GST" value={summary.totalExGst} primary />
            <SummaryRow label="GST (10%)" value={summary.gst} muted />
          </tbody>
        </table>

        {/* Grand Total band */}
        <div className="border-t-2 border-primary/25 bg-primary/[0.07] px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Grand Total
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Including GST</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-foreground/90">
            ${fmt(summary.grandTotal)}
          </p>
        </div>
      </div>

      <FloorPrepPanel
        area={settings.floor_prep_area}
        depthMm={settings.floor_prep_depth_mm}
        chargePerBag={settings.floor_prep_charge_per_bag}
        matPerBag={settings.floor_prep_mat_per_bag}
        labPerBag={settings.floor_prep_lab_per_bag}
        grindArea={settings.grind_area}
        grindLaborRate={settings.grind_labor_rate}
        grindChargeRate={settings.grind_charge_rate}
        includeFloorPrep={includeFloorPrep}
        onToggleFloorPrep={() => setIncludeFloorPrep((v) => !v)}
        includeGrind={includeGrind}
        onToggleGrind={() => setIncludeGrind((v) => !v)}
        onUpdate={updateSettings}
        onReset={resetFloorPrep}
      />

      </div>{/* end summary + floor prep flex row */}
    </div>
  );
}

// Columns: # | Code | Desc…Lab$/u (colspan 7) | Mat$ | Lab$ | Total | Del
function SubtotalRow({ label, matCost, labCost, total }: {
  label: string;
  matCost: number;
  labCost: number;
  total: number;
}) {
  return (
    <tr className="bg-primary/[0.05] border-b border-dotted border-border">
      <td className="px-1" />
      <td className="border-r border-border" />
      <td colSpan={7} className="border-r border-border px-2 py-1.5 text-right">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label} subtotal
        </span>
      </td>
      <td className="border-r border-border px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
        ${fmt(matCost)}
      </td>
      <td className="border-r border-border px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
        ${fmt(labCost)}
      </td>
      <td className="border-r border-border px-2 py-1.5 text-right text-xs tabular-nums font-semibold text-muted-foreground">
        ${fmt(total)}
      </td>
      <td />
    </tr>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  bold,
  subtotal,
  highlight,
  primary,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
  subtotal?: boolean;
  highlight?: "warning";
  primary?: boolean;
}) {
  return (
    <tr className={cn(
      "border-b border-border",
      subtotal && "bg-muted/20",
      primary && "bg-primary/[0.07] border-t-2 border-t-primary/25",
    )}>
      <td
        className={cn(
          "px-4 py-2 text-xs",
          primary ? "font-semibold text-foreground/80 uppercase tracking-wide text-[10px]"
          : bold ? "font-semibold text-muted-foreground"
          : subtotal ? "font-medium text-muted-foreground"
          : muted ? "text-muted-foreground/45"
          : "text-muted-foreground",
          highlight === "warning" && "text-warning"
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          "px-4 py-2 text-right tabular-nums",
          primary ? "text-xl font-bold text-foreground/90"
          : bold ? "text-sm font-semibold text-foreground/75"
          : subtotal ? "text-xs font-semibold text-foreground/70"
          : muted ? "text-xs text-muted-foreground/45"
          : "text-xs text-foreground/55",
          highlight === "warning" && "text-warning"
        )}
      >
        ${fmt(value)}
      </td>
    </tr>
  );
}
