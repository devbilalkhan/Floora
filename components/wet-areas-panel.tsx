"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Trash2, Droplets, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LAB } from "@/lib/default-rates";
import { type WetArea } from "@/lib/estimate-types";
import { addWetArea, updateWetArea, deleteWetArea } from "@/app/(protected)/orgs/[orgSlug]/projects/[projectId]/estimates/[estimateId]/costing/actions";

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => parseFloat((n || 0).toFixed(2));

const inp =
  "w-full text-[11px] tabular-nums text-right bg-transparent border-0 outline-none " +
  "focus:ring-1 focus:ring-inset focus:ring-primary/40 px-1.5 py-1 text-foreground/70 " +
  "placeholder:text-muted-foreground/55";

const ro =
  "w-full px-1.5 py-1 text-[11px] tabular-nums text-right text-foreground/55 select-none cursor-default";

type Patch = Partial<Pick<WetArea, "name" | "floor_sqm" | "wall_semi_sqm" | "wall_full_sqm" | "coving_lm" | "qty" | "charge">>;

type Rates = { floor: number; semi: number; full: number; coving: number };

function WetAreaRow({
  area,
  rates,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  area: WetArea;
  rates: Rates;
  onUpdate: (id: string, patch: Patch) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const [local, setLocal] = useState(area);
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal((prev) => ({ ...prev, ...area }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.id]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = useCallback(
    (patch: Patch) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onUpdate(area.id, pending.current);
        pending.current = {};
        timer.current = null;
      }, 600);
    },
    [area.id, onUpdate]
  );

  const flush = useCallback(
    (patch: Patch) => {
      const full = { ...pending.current, ...patch };
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      pending.current = {};
      if (Object.keys(full).length > 0) onUpdate(area.id, full);
    },
    [area.id, onUpdate]
  );

  const set = <K extends keyof WetArea>(field: K, value: WetArea[K]) =>
    setLocal((prev) => ({ ...prev, [field]: value }));

  const q        = Number(local.qty) || 1;
  const floorLab = (Number(local.floor_sqm)     || 0) * rates.floor;
  const semiLab  = (Number(local.wall_semi_sqm) || 0) * rates.semi;
  const fullLab  = (Number(local.wall_full_sqm) || 0) * rates.full;
  const covLab   = (Number(local.coving_lm)     || 0) * rates.coving;
  const unitLab  = floorLab + semiLab + fullLab + covLab;
  const totalLab = unitLab * q;
  const totalCharge = (Number(local.charge) || 0) * q;
  const diff     = totalCharge - totalLab;

  return (
    <tr className="border-b border-black/10 dark:border-white/10 hover:bg-muted/20 group">
      {/* Name */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input
          value={local.name}
          onChange={(e) => { set("name", e.target.value); schedule({ name: e.target.value }); }}
          onBlur={(e) => flush({ name: e.target.value.trim() || "Wet Area" })}
          className="w-full px-2 py-1 text-[11px] bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-primary/40 text-foreground/70 placeholder:text-muted-foreground/55"
          placeholder="Wet Area"
        />
      </td>

      {/* Floor m² */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={0} step={0.01}
          value={local.floor_sqm === 0 ? "" : r2(local.floor_sqm)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("floor_sqm", v); schedule({ floor_sqm: v }); }}
          onBlur={(e)  => { const v = parseFloat(e.target.value) || 0; set("floor_sqm", v); flush({ floor_sqm: v }); }}
          className={inp} placeholder="0.00" />
      </td>

      {/* Floor Lab (per area) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0 bg-muted/10">
        <div className={ro}>{floorLab > 0 ? `$${fmt(floorLab)}` : "—"}</div>
      </td>

      {/* Wall Semi m² */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={0} step={0.01}
          value={local.wall_semi_sqm === 0 ? "" : r2(local.wall_semi_sqm)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("wall_semi_sqm", v); schedule({ wall_semi_sqm: v }); }}
          onBlur={(e)  => { const v = parseFloat(e.target.value) || 0; set("wall_semi_sqm", v); flush({ wall_semi_sqm: v }); }}
          className={inp} placeholder="0.00" />
      </td>

      {/* Semi Lab (per area) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0 bg-muted/10">
        <div className={ro}>{semiLab > 0 ? `$${fmt(semiLab)}` : "—"}</div>
      </td>

      {/* Wall Full m² */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={0} step={0.01}
          value={local.wall_full_sqm === 0 ? "" : r2(local.wall_full_sqm)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("wall_full_sqm", v); schedule({ wall_full_sqm: v }); }}
          onBlur={(e)  => { const v = parseFloat(e.target.value) || 0; set("wall_full_sqm", v); flush({ wall_full_sqm: v }); }}
          className={inp} placeholder="0.00" />
      </td>

      {/* Full Lab (per area) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0 bg-muted/10">
        <div className={ro}>{fullLab > 0 ? `$${fmt(fullLab)}` : "—"}</div>
      </td>

      {/* Coving lm */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={0} step={0.1}
          value={local.coving_lm === 0 ? "" : r2(local.coving_lm)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("coving_lm", v); schedule({ coving_lm: v }); }}
          onBlur={(e)  => { const v = parseFloat(e.target.value) || 0; set("coving_lm", v); flush({ coving_lm: v }); }}
          className={inp} placeholder="0.0" />
      </td>

      {/* Coving Lab (per area) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0 bg-muted/10">
        <div className={ro}>{covLab > 0 ? `$${fmt(covLab)}` : "—"}</div>
      </td>

      {/* Total Labor (× qty) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0 bg-primary/5">
        <div className="w-full px-1.5 py-1 text-[11px] tabular-nums text-right font-semibold text-foreground/75 select-none cursor-default">
          {totalLab > 0 ? `$${fmt(totalLab)}` : "—"}
        </div>
      </td>

      {/* Qty */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={1} step={1}
          value={local.qty || ""}
          onChange={(e) => { const v = Math.max(1, parseInt(e.target.value) || 1); set("qty", v); schedule({ qty: v }); }}
          onBlur={(e)  => { const v = Math.max(1, parseInt(e.target.value) || 1); set("qty", v); flush({ qty: v }); }}
          className={inp} placeholder="1" />
      </td>

      {/* Charge (per area) */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <input type="number" min={0} step={0.01}
          value={local.charge === 0 ? "" : r2(local.charge)}
          onChange={(e) => { const v = parseFloat(e.target.value) || 0; set("charge", v); schedule({ charge: v }); }}
          onBlur={(e)  => { const v = parseFloat(e.target.value) || 0; set("charge", v); flush({ charge: v }); }}
          className={inp} placeholder="0.00" />
      </td>

      {/* Diff = (charge − labor) × qty */}
      <td className="border-r border-black/10 dark:border-white/10 p-0">
        <div className={cn(
          "w-full px-1.5 py-1 text-[11px] tabular-nums text-right font-semibold select-none cursor-default",
          local.charge === 0 && unitLab === 0 ? "text-muted-foreground/45"
          : diff < 0 ? "text-destructive"
          : "text-success"
        )}>
          {local.charge > 0 || unitLab > 0 ? `${diff >= 0 ? "+" : ""}$${fmt(diff)}` : "—"}
        </div>
      </td>

      {/* Actions */}
      <td className="w-14 text-center p-0">
        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center gap-0.5 transition-all">
          <button
            onClick={() => onDuplicate(area.id)}
            className="p-1 rounded-sm text-muted-foreground hover:text-primary transition-colors"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(area.id)}
            className="p-1 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function WetAreasPanel({
  estimateId,
  initialAreas,
  onChange,
}: {
  estimateId: string;
  initialAreas: WetArea[];
  onChange: (areas: WetArea[]) => void;
}) {
  const [areas, setAreas] = useState<WetArea[]>(initialAreas);

  const ratesKey = `wet-area-rates-${estimateId}`;
  const [rates, setRates] = useState<Rates>(() => {
    try {
      const saved = localStorage.getItem(ratesKey);
      if (saved) return { ...{ floor: LAB.vinyl, semi: LAB.wallVinylSemi, full: LAB.wallVinylFull, coving: LAB.coving }, ...JSON.parse(saved) };
    } catch {}
    return { floor: LAB.vinyl, semi: LAB.wallVinylSemi, full: LAB.wallVinylFull, coving: LAB.coving };
  });

  useEffect(() => {
    try { localStorage.setItem(ratesKey, JSON.stringify(rates)); } catch {}
  }, [ratesKey, rates]);

  const handleUpdate = useCallback(
    (id: string, patch: Patch) => {
      setAreas((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
        onChange(next);
        return next;
      });
      updateWetArea(id, patch).catch(() => toast.error("Save failed."));
    },
    [onChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const next = areas.filter((a) => a.id !== id);
      setAreas(next);
      onChange(next);
      deleteWetArea(id).catch(() => toast.error("Delete failed."));
    },
    [areas, onChange]
  );

  const handleAdd = async () => {
    try {
      const nextOrder = areas.length ? Math.max(...areas.map((a) => a.sort_order)) + 1 : 0;
      const newArea = await addWetArea(estimateId, nextOrder);
      const next = [...areas, newArea];
      setAreas(next);
      onChange(next);
    } catch {
      toast.error("Failed to add wet area.");
    }
  };

  const handleDuplicate = useCallback(
    async (id: string) => {
      const src = areas.find((a) => a.id === id);
      if (!src) return;
      try {
        const nextOrder = Math.max(...areas.map((a) => a.sort_order)) + 1;
        const newArea = await addWetArea(estimateId, nextOrder);
        const patch: Patch = {
          name: src.name,
          floor_sqm: src.floor_sqm,
          wall_semi_sqm: src.wall_semi_sqm,
          wall_full_sqm: src.wall_full_sqm,
          coving_lm: src.coving_lm,
          qty: src.qty,
          charge: src.charge,
        };
        await updateWetArea(newArea.id, patch);
        const next = [...areas, { ...newArea, ...patch }];
        setAreas(next);
        onChange(next);
      } catch {
        toast.error("Failed to duplicate wet area.");
      }
    },
    [areas, estimateId, onChange]
  );

  const totalLab    = areas.reduce((s, a) => {
    const lab = (Number(a.floor_sqm) || 0) * rates.floor
              + (Number(a.wall_semi_sqm) || 0) * rates.semi
              + (Number(a.wall_full_sqm) || 0) * rates.full
              + (Number(a.coving_lm) || 0) * rates.coving;
    return s + lab * (Number(a.qty) || 1);
  }, 0);
  const totalCharge = areas.reduce((s, a) => s + (Number(a.charge) || 0) * (Number(a.qty) || 1), 0);
  const totalDiff   = totalCharge - totalLab;

  // 14 columns: Name | Floor m² | Floor Lab | Semi m² | Semi Lab | Full m² | Full Lab | Cov lm | Cov Lab | Total Lab | Qty | Charge | Diff | Del
  const COLS = 14;

  return (
    <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden bg-card/65 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/10 dark:border-white/10 bg-muted/30">
        <Droplets className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Wet Areas
        </span>
        {areas.length > 0 && (
          <span className="text-[10px] text-muted-foreground/45">
            ({areas.length} type{areas.length !== 1 ? "s" : ""})
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {([
            ["Floor",     "floor",  "/m²"] as const,
            ["Wall Semi", "semi",   "/m²"] as const,
            ["Wall Full", "full",   "/m²"] as const,
            ["Coving",    "coving", "/lm"] as const,
          ]).map(([label, key, unit]) => (
            <label
              key={key}
              className="flex items-center gap-1 bg-muted/40 border border-black/10 dark:border-white/10 rounded px-2 py-1 cursor-text hover:border-black/[0.18] dark:hover:border-white/[0.18] transition-colors"
            >
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap select-none">
                {label}
              </span>
              <span className="text-[9px] text-muted-foreground/45 select-none">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={rates[key]}
                onChange={(e) => setRates((r) => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                className="w-8 text-right bg-transparent border-0 outline-none text-[10px] tabular-nums text-foreground/70 focus:text-foreground/90 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground/45 select-none">{unit}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 980 }}>
          <colgroup>
            <col style={{ width: 140 }} /> {/* Name */}
            <col style={{ width: 68 }} />  {/* Floor m² */}
            <col style={{ width: 72 }} />  {/* Floor Lab */}
            <col style={{ width: 68 }} />  {/* Semi m² */}
            <col style={{ width: 72 }} />  {/* Semi Lab */}
            <col style={{ width: 68 }} />  {/* Full m² */}
            <col style={{ width: 72 }} />  {/* Full Lab */}
            <col style={{ width: 60 }} />  {/* Coving lm */}
            <col style={{ width: 72 }} />  {/* Cov Lab */}
            <col style={{ width: 80 }} />  {/* Total Lab */}
            <col style={{ width: 44 }} />  {/* Qty */}
            <col style={{ width: 76 }} />  {/* Charge */}
            <col style={{ width: 76 }} />  {/* Diff */}
            <col style={{ width: 56 }} />  {/* Actions */}
          </colgroup>

          <thead>
            <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
              {([
                ["Name",         "text-left",  false],
                ["Floor m²",     "text-right", false],
                ["Floor Lab",    "text-right", true],
                ["Wall Semi m²", "text-right", false],
                ["Semi Lab",     "text-right", true],
                ["Wall Full m²", "text-right", false],
                ["Full Lab",     "text-right", true],
                ["Coving lm",    "text-right", false],
                ["Coving Lab",   "text-right", true],
                ["Total Labor",  "text-right", false],
                ["Qty",          "text-right", false],
                ["Charge",       "text-right", false],
                ["Diff",         "text-right", false],
                ["",             "",           false],
              ] as [string, string, boolean][]).map(([label, align, shaded], i) => (
                <th
                  key={i}
                  className={cn(
                    "px-2 py-1 text-[9px] font-medium text-muted-foreground uppercase tracking-wide border-r border-black/10 dark:border-white/10 last:border-r-0",
                    align,
                    shaded && "bg-muted/20"
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {areas
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((area) => (
                <WetAreaRow
                  key={area.id}
                  area={area}
                  rates={rates}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}

            {/* Add row */}
            <tr>
              <td colSpan={COLS} className="px-3 py-1.5">
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary transition-colors py-0.5"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add wet area
                </button>
              </td>
            </tr>

            {/* Totals footer */}
            {areas.length > 0 && (
              <tr className="bg-muted/25 border-t-2 border-black/[0.15] dark:border-white/[0.15]">
                <td colSpan={9} className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Totals
                </td>
                <td className="border-l border-black/10 dark:border-white/10 px-1.5 py-2 text-right text-[11px] tabular-nums font-semibold text-foreground/75">
                  ${fmt(totalLab)}
                </td>
                <td className="border-l border-black/10 dark:border-white/10" /> {/* Qty — no total */}
                <td className="border-l border-black/10 dark:border-white/10 px-1.5 py-2 text-right text-[11px] tabular-nums font-semibold text-foreground/75">
                  ${fmt(totalCharge)}
                </td>
                <td className={cn(
                  "border-l border-black/10 dark:border-white/10 px-1.5 py-2 text-right text-[11px] tabular-nums font-bold",
                  totalDiff < 0 ? "text-destructive" : "text-success"
                )}>
                  {`${totalDiff >= 0 ? "+" : ""}$${fmt(totalDiff)}`}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
