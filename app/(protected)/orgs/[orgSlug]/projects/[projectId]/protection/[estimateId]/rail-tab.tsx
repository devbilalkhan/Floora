"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RailDefaults, RailLine, RailTotals } from "@/lib/rail-calc";
import { NumInput } from "./num-input";
import { CALC, DefaultField, IssueIcon, TD, TH, TextInput, money } from "./table-parts";

const CALC_CELL = `${CALC} border-r border-black/10 dark:border-white/10`;

const lm = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 2 });

// Editable columns in on-screen order — a pasted Excel block fills these left to right
export const RAIL_PASTE_FIELDS = [
  "description",
  "length_lm",
  "order_lm",
  "price",
  "install_rate",
  "brackets_qty",
  "bracket_price",
  "screws_qty",
  "screw_price",
  "notes",
] as const satisfies readonly (keyof RailLine)[];

export type RailPasteField = (typeof RAIL_PASTE_FIELDS)[number];

/** Converts one pasted cell to the field's type. Non-numbers ("n/a", blank) become null, or 0 for quantities. */
export function parseRailPasted(field: RailPasteField, raw: string): string | number | null {
  const value = raw.trim();
  if (field === "description" || field === "notes") return value === "" ? null : value;
  const n = Number(value.replace(/[$,\s]/g, ""));
  const qty = field === "brackets_qty" || field === "screws_qty";
  if (value === "" || !Number.isFinite(n) || n < 0) return qty ? 0 : null;
  return qty ? Math.round(n) : n;
}

/** One linear-metre rail tab — used for both Handrails and Crash rail, which price identically. */
export function RailTab({
  label,
  defaults,
  lines,
  totals,
  onDefault,
  onLine,
  onAddLine,
  onDeleteLine,
  onPaste,
}: {
  /** Trade name as shown in the total, e.g. "Handrails" */
  label: string;
  defaults: RailDefaults;
  lines: RailLine[];
  totals: RailTotals;
  onDefault: <K extends keyof RailDefaults>(key: K, value: RailDefaults[K]) => void;
  onLine: <K extends keyof RailLine>(id: string, key: K, value: RailLine[K]) => void;
  onAddLine: () => void;
  onDeleteLine: (id: string) => void;
  onPaste: (id: string, field: RailPasteField) => React.ClipboardEventHandler<HTMLInputElement>;
}) {
  const has = (issues: { code: string }[], code: string) => issues.some((i) => i.code === code);

  return (
    <div className="space-y-4">
      {/* Job defaults */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Job defaults — used by every line unless the line enters its own value.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <DefaultField label="Material $ / m">
            <NumInput ariaLabel="Default material price per metre" value={defaults.default_price}
              onChange={(v) => onDefault("default_price", v)} />
          </DefaultField>
          <DefaultField label="Install $ / m">
            <NumInput ariaLabel="Default install rate per metre" value={defaults.install_rate}
              onChange={(v) => onDefault("install_rate", v)} />
          </DefaultField>
        </div>
      </div>

      {/* Lines */}
      <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead className="bg-muted/40">
            <tr>
              <th className={`${TH} w-8 text-center`}>#</th>
              <th className={`${TH} w-6`} />
              <th className={`${TH} text-left min-w-[220px]`}>Description</th>
              <th className={`${TH} text-right w-20`}>Length lm</th>
              <th className={`${TH} text-right w-20`} title="Length to order incl. wastage — blank = measured length">
                Order lm
              </th>
              <th className={`${TH} text-right w-20`}>$ / m</th>
              <th className={`${TH} text-right w-20`}>Install $ / m</th>
              <th className={`${TH} text-right w-16`}>Brackets</th>
              <th className={`${TH} text-right w-20`}>$ each</th>
              <th className={`${TH} text-right w-16`}>Screws</th>
              <th className={`${TH} text-right w-20`}>$ each</th>
              <th className={`${TH} text-right`}>Material</th>
              <th className={`${TH} text-right`}>Labour</th>
              <th className={`${TH} text-right`}>Line total</th>
              <th className={`${TH} text-left min-w-[160px]`}>Notes</th>
              <th className="border-b border-black/10 dark:border-white/10 w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No lines yet — add the first run.
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
                    <TextInput onPaste={onPaste(line.id, "description")} ariaLabel={`Line ${idx + 1} description`}
                      value={line.description} onChange={(v) => onLine(line.id, "description", v)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "length_lm")} ariaLabel="Length lm" value={line.length_lm}
                      onChange={(v) => onLine(line.id, "length_lm", v)} />
                  </td>
                  <td className={TD}>
                    <NumInput
                      onPaste={onPaste(line.id, "order_lm")}
                      ariaLabel="Order lm"
                      value={line.order_lm}
                      inherited={line.length_lm}
                      title={
                        line.order_lm === null
                          ? "Same as the measured length — type a length incl. wastage to override"
                          : "Typed-in order length — clear to use the measured length"
                      }
                      onChange={(v) => onLine(line.id, "order_lm", v)}
                      tone={has(r.issues, "order_below_length") ? "warn" : undefined}
                    />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "price")} ariaLabel="Material price per metre" value={line.price}
                      inherited={defaults.default_price} onChange={(v) => onLine(line.id, "price", v)}
                      tone={has(r.issues, "missing_price") ? "warn" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "install_rate")} ariaLabel="Install rate per metre" value={line.install_rate}
                      inherited={defaults.install_rate} onChange={(v) => onLine(line.id, "install_rate", v)}
                      tone={blocked ? "error" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "brackets_qty")} ariaLabel="Brackets" integer value={line.brackets_qty}
                      onChange={(v) => onLine(line.id, "brackets_qty", v ?? 0)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "bracket_price")} ariaLabel="Bracket price" value={line.bracket_price}
                      onChange={(v) => onLine(line.id, "bracket_price", v)}
                      tone={has(r.issues, "missing_bracket_price") ? "warn" : undefined} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "screws_qty")} ariaLabel="Screws" integer value={line.screws_qty}
                      onChange={(v) => onLine(line.id, "screws_qty", v ?? 0)} />
                  </td>
                  <td className={TD}>
                    <NumInput onPaste={onPaste(line.id, "screw_price")} ariaLabel="Screw price" value={line.screw_price}
                      onChange={(v) => onLine(line.id, "screw_price", v)}
                      tone={has(r.issues, "missing_screw_price") ? "warn" : undefined} />
                  </td>
                  <td className={CALC_CELL}>{money(r.material)}</td>
                  <td className={CALC_CELL}>{blocked ? "—" : money(r.labour)}</td>
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
            <span className="text-muted-foreground">Length</span>
            <span className="tabular-nums text-foreground/70">
              {lm(totals.lengthLm)} lm measured · {lm(totals.orderLm)} lm to order
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Material</span>
            <span className="tabular-nums text-foreground/70">{money(totals.material)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Labour</span>
            <span className="tabular-nums text-foreground/70">{money(totals.labour)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
            <span>{label} total</span>
            {totals.blockedLines > 0 ? (
              <span className="text-destructive text-xs font-medium">
                Incomplete — {totals.blockedLines} {totals.blockedLines === 1 ? "line" : "lines"} missing install rate
              </span>
            ) : (
              <span className="tabular-nums">{money(totals.total)}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            Cost only, ex GST — labour on measured length, material on order length. Admin and markup are added in
            the Costing summary tab.
          </p>
        </div>
      </div>
    </div>
  );
}
