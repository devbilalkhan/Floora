"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supplyInstallRate } from "@/lib/wall-panel-calc";
import type { WallPanelDefaults, WallPanelLine, WallPanelTotals, WeldRodLine } from "@/lib/wall-panel-calc";
import { NumInput } from "./num-input";
import { CALC, DefaultField, IssueIcon, TD, TH, TextInput, money } from "./table-parts";

const CALC_CELL = `${CALC} border-r border-black/10 dark:border-white/10`;

// Editable columns in on-screen order — a pasted Excel block fills these left to right
export const WP_PASTE_FIELDS = [
  "item_code",
  "product",
  "gross_m2",
  "net_m2",
  "sheet_width_mm",
  "sheet_length_mm",
  "sheets_override",
  "wastage_pct",
  "price",
  "install_rate",
  "glue_rate",
  "cutouts_qty",
  "cutout_rate",
  "notes",
] as const satisfies readonly (keyof WallPanelLine)[];

export type WpPasteField = (typeof WP_PASTE_FIELDS)[number];

const WP_TEXT: WpPasteField[] = ["item_code", "product", "notes"];
const WP_INTEGER: WpPasteField[] = ["sheet_width_mm", "sheet_length_mm", "sheets_override", "cutouts_qty"];

/** Converts one pasted cell to the field's type. Non-numbers ("n/a", blank) become null, or 0 for cutouts. */
export function parseWpPasted(field: WpPasteField, raw: string): string | number | null {
  const value = raw.trim();
  if (WP_TEXT.includes(field)) return value === "" ? null : value;
  const n = Number(value.replace(/[$,%\s]/g, ""));
  const ok = value !== "" && Number.isFinite(n) && n >= 0;
  if (!ok) return field === "cutouts_qty" ? 0 : null;
  const v = WP_INTEGER.includes(field) ? Math.round(n) : n;
  // A 0 mm sheet size means "use the job default"
  return v === 0 && (field === "sheet_width_mm" || field === "sheet_length_mm") ? null : v;
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <td className="p-0 text-center">
      <button
        onClick={onClick}
        className="p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity"
        aria-label={label}
        title="Delete line"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </td>
  );
}

const RATE_BADGE =
  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-primary/10 text-primary border border-primary/20";

/** Sell S&I rate per installed panel as a badge; the cost rate shows on hover. */
function RateBadge({ rate, weldPerSheet }: { rate: { cost: number; sell: number } | null; weldPerSheet: number }) {
  if (!rate) return <span className="text-muted-foreground/50">—</span>;
  const weld = weldPerSheet > 0 ? ` incl. ${money(weldPerSheet)} weld rods` : "";
  return (
    <span
      className={RATE_BADGE}
      title={`Cost ${money(rate.cost)} / panel${weld} · sell is after admin and markup, ex GST (excludes preliminaries, freight/travel and retention)`}
    >
      {money(rate.sell)}
    </span>
  );
}

function TotalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground/70">{value}</span>
    </div>
  );
}

export function WallPanelTab({
  defaults,
  lines,
  rods,
  totals,
  adminPct,
  markupPct,
  onDefault,
  onLine,
  onAddLine,
  onDeleteLine,
  onPaste,
  onRod,
  onAddRod,
  onDeleteRod,
}: {
  defaults: WallPanelDefaults;
  lines: WallPanelLine[];
  rods: WeldRodLine[];
  totals: WallPanelTotals;
  adminPct: number;
  markupPct: number;
  onDefault: <K extends keyof WallPanelDefaults>(key: K, value: WallPanelDefaults[K]) => void;
  onLine: <K extends keyof WallPanelLine>(id: string, key: K, value: WallPanelLine[K]) => void;
  onAddLine: () => void;
  onDeleteLine: (id: string) => void;
  onPaste: (id: string, field: WpPasteField) => React.ClipboardEventHandler<HTMLInputElement>;
  onRod: <K extends keyof WeldRodLine>(id: string, key: K, value: WeldRodLine[K]) => void;
  onAddRod: () => void;
  onDeleteRod: (id: string) => void;
}) {
  const has = (issues: { code: string }[], code: string) => issues.some((i) => i.code === code);
  // Weld rods are job-level — spread evenly over every installed panel
  const weldPerSheet = totals.baseSheets > 0 ? totals.weldRods / totals.baseSheets : 0;

  return (
    <div className="space-y-4">
      {/* Job defaults */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Job defaults — used by every line unless the line enters its own value.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <DefaultField label="Sheet width mm">
            <NumInput ariaLabel="Default sheet width" integer value={defaults.wp_sheet_width_mm}
              onChange={(v) => v && onDefault("wp_sheet_width_mm", v)} />
          </DefaultField>
          <DefaultField label="Sheet length mm">
            <NumInput ariaLabel="Default sheet length" integer value={defaults.wp_sheet_length_mm}
              onChange={(v) => v && onDefault("wp_sheet_length_mm", v)} />
          </DefaultField>
          <DefaultField label="Wastage %">
            <NumInput ariaLabel="Default wastage" value={defaults.wp_wastage_pct}
              onChange={(v) => onDefault("wp_wastage_pct", v ?? 0)} />
          </DefaultField>
          <DefaultField label="Material $ / sheet">
            <NumInput ariaLabel="Default material price" value={defaults.wp_default_price}
              onChange={(v) => onDefault("wp_default_price", v)} />
          </DefaultField>
          <DefaultField label="Install $ / sheet">
            <NumInput ariaLabel="Default install rate" value={defaults.wp_install_rate}
              onChange={(v) => onDefault("wp_install_rate", v)} />
          </DefaultField>
          <DefaultField label="Glue $ / sheet">
            <NumInput ariaLabel="Default glue rate" value={defaults.wp_glue_rate}
              onChange={(v) => onDefault("wp_glue_rate", v)} />
          </DefaultField>
          <DefaultField label="Cutout $ each">
            <NumInput ariaLabel="Default cutout rate" value={defaults.wp_cutout_rate}
              onChange={(v) => onDefault("wp_cutout_rate", v)} />
          </DefaultField>
        </div>
      </div>

      {/* Panel lines */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead className="bg-muted/40">
            <tr>
              <th className={`${TH} w-8 text-center`}>#</th>
              <th className={`${TH} w-6`} />
              <th className={`${TH} text-left min-w-[100px]`}>Item code</th>
              <th className={`${TH} text-left min-w-[220px]`}>Product</th>
              <th className={`${TH} text-right w-28`}>Gross m²</th>
              <th className={`${TH} text-right w-20`}>Net m²</th>
              <th className={`${TH} text-right w-20`}>Width mm</th>
              <th className={`${TH} text-right w-20`}>Length mm</th>
              <th className={`${TH} text-right`}>m² / sheet</th>
              <th className={`${TH} text-right w-16`} title="Calculated from gross m² — type a count to override">Sheets</th>
              <th className={`${TH} text-right w-16`}>Waste %</th>
              <th className={`${TH} text-right`}>+ Waste</th>
              <th className={`${TH} text-right`}>Order</th>
              <th className={`${TH} text-right w-20`}>$ / sheet</th>
              <th className={`${TH} text-right w-20`}>Install $</th>
              <th className={`${TH} text-right w-20`}>Glue $</th>
              <th className={`${TH} text-right w-16`}>Cutouts</th>
              <th className={`${TH} text-right w-20`}>Cutout $</th>
              <th className={`${TH} text-right`}>Material</th>
              <th className={`${TH} text-right`}>Install</th>
              <th className={`${TH} text-right`}>Glue</th>
              <th className={`${TH} text-right`}>Cutouts</th>
              <th className={`${TH} text-right`}>Line total</th>
              <th className={`${TH} text-right`} title="Supply & install sell rate per installed panel — hover a rate for the cost">S&amp;I / panel</th>
              <th className={`${TH} text-left min-w-[160px]`}>Notes</th>
              <th className="border-b border-black/10 dark:border-white/10 w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No lines yet — add the first wall panel product.
                </td>
              </tr>
            )}
            {lines.map((line, idx) => {
              const r = totals.results.get(line.id)!;
              const blocked = has(r.issues, "missing_install");
              // How much bigger gross is than net (the openings deducted) — shown faintly in the gross cell
              const grossVsNet =
                line.gross_m2 !== null && line.net_m2 ? ((line.gross_m2 - line.net_m2) / line.net_m2) * 100 : null;
              return (
                <tr key={line.id} className="group border-b border-black/5 dark:border-white/5">
                  <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 px-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="border-r border-black/10 dark:border-white/10 px-1 text-center">
                    <IssueIcon issues={r.issues} />
                  </td>
                  <td className={TD}>
                    <TextInput onPaste={onPaste(line.id, "item_code")} ariaLabel={`Line ${idx + 1} item code`} value={line.item_code} placeholder="—"
                      onChange={(v) => onLine(line.id, "item_code", v)} />
                  </td>
                  <td className={TD}>
                    <TextInput onPaste={onPaste(line.id, "product")} ariaLabel={`Line ${idx + 1} product`} value={line.product}
                      onChange={(v) => onLine(line.id, "product", v)} />
                  </td>
                  <td className={`${TD} relative`}>
                    <NumInput onPaste={onPaste(line.id, "gross_m2")} ariaLabel="Gross m²" value={line.gross_m2}
                      onChange={(v) => onLine(line.id, "gross_m2", v)}
                      tone={has(r.issues, "no_area") ? "warn" : undefined} />
                    {grossVsNet !== null && (
                      <span
                        title={
                          grossVsNet >= 0
                            ? `Gross is ${grossVsNet.toFixed(1)}% more than net`
                            : "Net is larger than gross — check the takeoff"
                        }
                        className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] tabular-nums ${
                          grossVsNet >= 0 ? "text-primary/60" : "text-amber-600/80 dark:text-amber-400/80"
                        }`}
                      >
                        {grossVsNet >= 0 ? "+" : ""}
                        {grossVsNet.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "net_m2")} ariaLabel="Net m²" value={line.net_m2} title="For reference — sheets are calculated from gross m²"
                      onChange={(v) => onLine(line.id, "net_m2", v)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "sheet_width_mm")} ariaLabel="Sheet width" integer value={line.sheet_width_mm} inherited={defaults.wp_sheet_width_mm}
                      onChange={(v) => onLine(line.id, "sheet_width_mm", v || null)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "sheet_length_mm")} ariaLabel="Sheet length" integer value={line.sheet_length_mm} inherited={defaults.wp_sheet_length_mm}
                      onChange={(v) => onLine(line.id, "sheet_length_mm", v || null)} />
                  </td>
                  <td className={CALC_CELL}>{r.sheetM2}</td>
                  <td className={TD}>
                    <NumInput
                      ariaLabel="Sheets"
                      onPaste={onPaste(line.id, "sheets_override")}
                      integer
                      value={line.sheets_override}
                      inherited={r.areaSheets}
                      title={
                        line.sheets_override === null
                          ? "Calculated from gross m² — type a count to override"
                          : "Typed-in sheet count — clear to calculate from gross m²"
                      }
                      onChange={(v) => onLine(line.id, "sheets_override", v)}
                      tone={has(r.issues, "override_below_area") ? "warn" : undefined}
                    />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "wastage_pct")} ariaLabel="Wastage %" value={line.wastage_pct} inherited={defaults.wp_wastage_pct}
                      onChange={(v) => onLine(line.id, "wastage_pct", v)} />
                  </td>
                  <td className={CALC_CELL}>{r.wasteSheets}</td>
                  <td className={`${CALC_CELL} font-medium text-foreground`}>{r.totalSheets}</td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "price")} ariaLabel="Material price per sheet" value={line.price} inherited={defaults.wp_default_price}
                      onChange={(v) => onLine(line.id, "price", v)}
                      tone={has(r.issues, "missing_price") ? "warn" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "install_rate")} ariaLabel="Install rate per sheet" value={line.install_rate} inherited={defaults.wp_install_rate}
                      onChange={(v) => onLine(line.id, "install_rate", v)}
                      tone={blocked ? "error" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "glue_rate")} ariaLabel="Glue rate per sheet" value={line.glue_rate} inherited={defaults.wp_glue_rate}
                      onChange={(v) => onLine(line.id, "glue_rate", v)}
                      tone={has(r.issues, "missing_glue") ? "warn" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "cutouts_qty")} ariaLabel="Cutouts" integer value={line.cutouts_qty}
                      onChange={(v) => onLine(line.id, "cutouts_qty", v ?? 0)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "cutout_rate")} ariaLabel="Cutout rate" value={line.cutout_rate} inherited={defaults.wp_cutout_rate}
                      onChange={(v) => onLine(line.id, "cutout_rate", v)}
                      tone={has(r.issues, "missing_cutout_rate") ? "warn" : undefined} />
                  </td>
                  <td className={CALC_CELL}>{money(r.material)}</td>
                  <td className={CALC_CELL}>{blocked ? "—" : money(r.install)}</td>
                  <td className={CALC_CELL}>{money(r.glue)}</td>
                  <td className={CALC_CELL}>{money(r.cutouts)}</td>
                  <td className={`${CALC_CELL} font-medium ${blocked ? "text-destructive" : "text-foreground"}`}>
                    {blocked ? "No install rate" : money(r.total)}
                  </td>
                  <td className={CALC_CELL}>
                    <RateBadge
                      weldPerSheet={weldPerSheet}
                      rate={blocked ? null : supplyInstallRate(r.total + weldPerSheet * r.baseSheets, r.baseSheets, adminPct, markupPct)}
                    />
                  </td>
                  <td className={TD}>
                    <TextInput onPaste={onPaste(line.id, "notes")} ariaLabel={`Line ${idx + 1} notes`} value={line.notes}
                      onChange={(v) => onLine(line.id, "notes", v)} />
                  </td>
                  <DeleteButton label={`Delete line ${idx + 1}`} onClick={() => onDeleteLine(line.id)} />
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

      {/* Weld rods — separate cost lines, not part of any panel's material (spec rule 6) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold">Weld rods</h3>
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead className="bg-muted/40">
              <tr>
                <th className={`${TH} w-8 text-center`}>#</th>
                <th className={`${TH} w-6`} />
                <th className={`${TH} text-left min-w-[220px]`}>Description</th>
                <th className={`${TH} text-right w-20`}>Qty</th>
                <th className={`${TH} text-left w-24`}>Unit</th>
                <th className={`${TH} text-right w-20`}>$ / unit</th>
                <th className={`${TH} text-right w-16`}>Waste %</th>
                <th className={`${TH} text-right w-20`}>Labour $</th>
                <th className={`${TH} text-right`}>Supply</th>
                <th className={`${TH} text-right`}>Total</th>
                <th className={`${TH} text-left min-w-[160px]`}>Notes</th>
                <th className="border-b border-black/10 dark:border-white/10 w-8" />
              </tr>
            </thead>
            <tbody>
              {rods.length === 0 && (
                <tr>
                  <td colSpan={99} className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No weld rods.
                  </td>
                </tr>
              )}
              {rods.map((rod, idx) => {
                const r = totals.rodResults.get(rod.id)!;
                return (
                  <tr key={rod.id} className="group border-b border-black/5 dark:border-white/5">
                    <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 px-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="border-r border-black/10 dark:border-white/10 px-1 text-center">
                      <IssueIcon issues={r.issues} />
                    </td>
                    <td className={TD}>
                      <TextInput ariaLabel={`Weld rod ${idx + 1} description`} value={rod.description}
                        onChange={(v) => onRod(rod.id, "description", v)} />
                    </td>
                    <td className={TD}>
                      <NumInput ariaLabel="Weld rod qty" value={rod.qty} onChange={(v) => onRod(rod.id, "qty", v ?? 0)} />
                    </td>
                    <td className={`${TD} ${has(r.issues, "missing_unit") ? "ring-1 ring-inset ring-amber-500/60 bg-amber-500/10" : ""}`}>
                      <TextInput ariaLabel={`Weld rod ${idx + 1} unit`} value={rod.unit} placeholder="lm, m², roll…"
                        onChange={(v) => onRod(rod.id, "unit", v)} />
                    </td>
                    <td className={TD}>
                      <NumInput ariaLabel="Weld rod unit cost" value={rod.unit_cost}
                        onChange={(v) => onRod(rod.id, "unit_cost", v)}
                        tone={has(r.issues, "missing_unit_cost") ? "warn" : undefined} />
                    </td>
                    <td className={TD}>
                      <NumInput ariaLabel="Weld rod wastage %" value={rod.wastage_pct}
                        onChange={(v) => onRod(rod.id, "wastage_pct", v ?? 0)} />
                    </td>
                    <td className={TD}>
                      <NumInput ariaLabel="Weld rod labour" value={rod.labour} onChange={(v) => onRod(rod.id, "labour", v)} />
                    </td>
                    <td className={CALC_CELL}>{money(r.supply)}</td>
                    <td className={`${CALC_CELL} font-medium text-foreground`}>{money(r.total)}</td>
                    <td className={TD}>
                      <TextInput ariaLabel={`Weld rod ${idx + 1} notes`} value={rod.notes}
                        onChange={(v) => onRod(rod.id, "notes", v)} />
                    </td>
                    <DeleteButton label={`Delete weld rod ${idx + 1}`} onClick={() => onDeleteRod(rod.id)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" onClick={onAddRod}>
          <Plus className="h-3.5 w-3.5" />
          Add weld rod
        </Button>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-1.5 text-xs">
          <TotalRow
            label="Sheets"
            value={`${totals.baseSheets} installed · ${totals.totalSheets - totals.baseSheets} waste · ${totals.totalSheets} to order`}
          />
          <TotalRow label="Material" value={money(totals.material)} />
          <TotalRow label="Install" value={money(totals.install)} />
          <TotalRow label="Glue" value={money(totals.glue)} />
          <TotalRow label="Cutouts" value={money(totals.cutouts)} />
          {rods.length > 0 && <TotalRow label="Weld rods" value={money(totals.weldRods)} />}
          <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
            <span>Wall panels total</span>
            {totals.blockedLines > 0 ? (
              <span className="text-destructive text-xs font-medium">
                Incomplete — {totals.blockedLines} {totals.blockedLines === 1 ? "line" : "lines"} missing install rate
              </span>
            ) : (
              <span className="tabular-nums">{money(totals.total)}</span>
            )}
          </div>
          {totals.blockedLines === 0 && totals.baseSheets > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Average S&amp;I / panel</span>
              <RateBadge weldPerSheet={weldPerSheet} rate={supplyInstallRate(totals.total, totals.baseSheets, adminPct, markupPct)} />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/50">
            Cost only, ex GST — admin, markup, training and freight are added in the Costing summary tab.
          </p>
        </div>
      </div>
    </div>
  );
}
