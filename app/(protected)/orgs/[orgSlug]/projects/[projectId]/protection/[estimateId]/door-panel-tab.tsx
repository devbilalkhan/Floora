"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DoorPanelLine, DoorPanelTotals } from "@/lib/door-panel-calc";
import { NumInput } from "./num-input";
import { CALC, IssueIcon, TD, TH, TextInput, money } from "./table-parts";

const CALC_CELL = `${CALC} border-r border-black/10 dark:border-white/10`;

// Editable columns in on-screen order (the Cut tick box is skipped) — a pasted Excel block fills these left to right
export const DP_PASTE_FIELDS = [
  "item",
  "sheets_qty",
  "price",
  "panels_qty",
  "install_rate",
  "cutting_rate",
  "glue_rate",
  "notes",
] as const satisfies readonly (keyof DoorPanelLine)[];

export type DpPasteField = (typeof DP_PASTE_FIELDS)[number];

/** Converts one pasted cell to the field's type. Non-numbers ("n/a", blank) become null, or 0 for quantities. */
export function parseDpPasted(field: DpPasteField, raw: string): string | number | null {
  const value = raw.trim();
  if (field === "item" || field === "notes") return value === "" ? null : value;
  const n = Number(value.replace(/[$,\s]/g, ""));
  const qty = field === "sheets_qty" || field === "panels_qty";
  if (value === "" || !Number.isFinite(n) || n < 0) return qty ? 0 : null;
  return qty ? Math.round(n) : n;
}

export function DoorPanelTab({
  lines,
  totals,
  onLine,
  onAddLine,
  onDeleteLine,
  onPaste,
}: {
  lines: DoorPanelLine[];
  totals: DoorPanelTotals;
  onLine: <K extends keyof DoorPanelLine>(id: string, key: K, value: DoorPanelLine[K]) => void;
  onAddLine: () => void;
  onDeleteLine: (id: string) => void;
  onPaste: (id: string, field: DpPasteField) => React.ClipboardEventHandler<HTMLInputElement>;
}) {
  const has = (issues: { code: string }[], code: string) => issues.some((i) => i.code === code);

  return (
    <div className="space-y-4">
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead className="bg-muted/40">
            <tr>
              <th className={`${TH} w-8 text-center`}>#</th>
              <th className={`${TH} w-6`} />
              <th className={`${TH} text-left min-w-[220px]`}>Item</th>
              <th className={`${TH} text-right w-16`}>Sheets</th>
              <th className={`${TH} text-right w-20`}>$ / sheet</th>
              <th className={`${TH} text-right`}>Material</th>
              <th className={`${TH} text-right w-16`}>Panels</th>
              <th className={`${TH} text-right w-20`}>Install $ / panel</th>
              <th className={`${TH} text-center w-12`} title="Tick to add cutting to install">Cut</th>
              <th className={`${TH} text-right w-20`}>Cutting $ / panel</th>
              <th className={`${TH} text-right`}>Install incl. cutting</th>
              <th className={`${TH} text-right w-20`}>Glue $ / panel</th>
              <th className={`${TH} text-right`}>Glue</th>
              <th className={`${TH} text-right`}>Total</th>
              <th className={`${TH} text-left min-w-[160px]`}>Notes</th>
              <th className="border-b border-black/10 dark:border-white/10 w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No lines yet — add the first door panel item.
                </td>
              </tr>
            )}
            {lines.map((line, idx) => {
              const r = totals.results.get(line.id)!;
              const blocked = has(r.issues, "missing_install");
              return (
                <tr key={line.id} className="group border-b border-black/5 dark:border-white/5">
                  <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 px-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="border-r border-black/10 dark:border-white/10 px-1 text-center">
                    <IssueIcon issues={r.issues} />
                  </td>
                  <td className={TD}>
                    <TextInput onPaste={onPaste(line.id, "item")} ariaLabel={`Line ${idx + 1} item`} value={line.item}
                      onChange={(v) => onLine(line.id, "item", v)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "sheets_qty")} ariaLabel="Sheets" integer value={line.sheets_qty}
                      onChange={(v) => onLine(line.id, "sheets_qty", v ?? 0)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "price")} ariaLabel="Price per sheet" value={line.price}
                      onChange={(v) => onLine(line.id, "price", v)}
                      tone={has(r.issues, "missing_price") ? "warn" : undefined} />
                  </td>
                  <td className={CALC_CELL}>{money(r.material)}</td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "panels_qty")} ariaLabel="Panels" integer value={line.panels_qty}
                      onChange={(v) => onLine(line.id, "panels_qty", v ?? 0)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "install_rate")} ariaLabel="Install rate per panel" value={line.install_rate}
                      onChange={(v) => onLine(line.id, "install_rate", v)}
                      tone={blocked ? "error" : undefined} />
                  </td>
                  <td className={`${TD} text-center`}>
                    <input
                      type="checkbox"
                      aria-label="Add cutting to install"
                      checked={line.cutting_enabled}
                      onChange={(e) => onLine(line.id, "cutting_enabled", e.target.checked)}
                      className="h-3.5 w-3.5 accent-primary align-middle"
                    />
                  </td>
                  <td className={TD}>
                    <NumInput
                      onPaste={onPaste(line.id, "cutting_rate")}
                      ariaLabel="Cutting rate per panel"
                      value={line.cutting_rate}
                      title={line.cutting_enabled ? undefined : "Not counted — tick Cut to add cutting to install"}
                      onChange={(v) => onLine(line.id, "cutting_rate", v)}
                      className={line.cutting_enabled ? "" : "opacity-50 line-through"}
                      tone={has(r.issues, "missing_cutting_rate") ? "warn" : undefined}
                    />
                  </td>
                  <td className={CALC_CELL}>{blocked ? "—" : money(r.install)}</td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "glue_rate")} ariaLabel="Glue rate per panel" value={line.glue_rate}
                      onChange={(v) => onLine(line.id, "glue_rate", v)}
                      tone={has(r.issues, "missing_glue") ? "warn" : undefined} />
                  </td>
                  <td className={CALC_CELL}>{money(r.glue)}</td>
                  <td className={`${CALC_CELL} font-medium ${blocked ? "text-destructive" : "text-foreground"}`}>
                    {blocked ? "No install rate" : money(r.total)}
                  </td>
                  <td className={TD}>
                    <TextInput onPaste={onPaste(line.id, "notes")} ariaLabel={`Line ${idx + 1} notes`} value={line.notes}
                      onChange={(v) => onLine(line.id, "notes", v)} />
                  </td>
                  <td className="p-0 text-center">
                    <button
                      onClick={() => onDeleteLine(line.id)}
                      className="p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity"
                      aria-label={`Delete line ${idx + 1}`}
                      title="Delete line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={onAddLine}>
          <Plus className="h-3.5 w-3.5" />
          Add line
        </Button>
        <span className="text-xs text-muted-foreground">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantity</span>
            <span className="tabular-nums text-foreground/70">
              {totals.sheets} sheets · {totals.panels} panels
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Material</span>
            <span className="tabular-nums text-foreground/70">{money(totals.material)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Install incl. cutting</span>
            <span className="tabular-nums text-foreground/70">{money(totals.install)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Glue</span>
            <span className="tabular-nums text-foreground/70">{money(totals.glue)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
            <span>Door panels total</span>
            {totals.blockedLines > 0 ? (
              <span className="text-destructive text-xs font-medium">
                Incomplete — {totals.blockedLines} {totals.blockedLines === 1 ? "line" : "lines"} missing install rate
              </span>
            ) : (
              <span className="tabular-nums">{money(totals.total)}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            Cost only, ex GST — admin and markup are added in the Costing summary tab.
          </p>
        </div>
      </div>
    </div>
  );
}
