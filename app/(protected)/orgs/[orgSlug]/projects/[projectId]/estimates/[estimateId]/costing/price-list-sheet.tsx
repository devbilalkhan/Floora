"use client";

import { useState } from "react";
import { Check, Clipboard, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MATERIAL_PRICE_LIST,
  LABOUR_PRICE_LIST,
  FLOOR_PROTECTION_PRODUCTS,
  FLOOR_PROTECTION_RATES,
  FLOOR_PROTECTION_CLIENT_RATES,
} from "@/lib/price-list-data";
import { copyTableToClipboard } from "@/lib/copy-table";
import { CATEGORIES } from "@/lib/takeoff-types";

type SheetType = "materials" | "labour" | "protection" | null;

function PriceSheet({
  type,
  onClose,
}: {
  type: "materials" | "labour" | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  if (!type) return null;

  const isMaterials = type === "materials";
  const list = isMaterials ? MATERIAL_PRICE_LIST : LABOUR_PRICE_LIST;
  const rateKey = isMaterials ? "mat_rate" : "lab_rate";

  const filtered = list.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      item.description.toLowerCase().includes(q) ||
      ("manufacturer" in item && (item.manufacturer as string).toLowerCase().includes(q));
    const matchScope = scopeFilter === "all" || item.scope === scopeFilter;
    return matchSearch && matchScope;
  });

  // Only show scope pills that have items in this list
  const availableScopes = new Set(list.map((i) => i.scope));
  const scopePills = CATEGORIES.filter((c) => availableScopes.has(c.key));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[560px] flex flex-col gap-0 p-0 bg-card border-l border-border"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-semibold text-foreground/75">
            {isMaterials ? "Material Price List" : "Labour Price List"}
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Reference only — rates shown here are catalog defaults, not linked to any estimate.
          </p>
        </SheetHeader>

        {/* Search + scope filter */}
        <div className="px-4 py-3 border-b border-border space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isMaterials ? "Search products or brands…" : "Search labour items…"}
              className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-input border border-border rounded-md text-foreground/70 placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
            />
          </div>

          {/* Scope pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setScopeFilter("all")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border transition-colors",
                scopeFilter === "all"
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground/70"
              )}
            >
              All
            </button>
            {scopePills.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setScopeFilter(cat.key)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border transition-colors",
                  scopeFilter === cat.key
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground/70"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </th>
                {isMaterials && (
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-28">
                    Brand
                  </th>
                )}
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-14">
                  Unit
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-20">
                  {isMaterials ? "Mat $/u" : "Lab $/u"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isMaterials ? 4 : 3}
                    className="px-3 py-10 text-center text-[11px] text-muted-foreground"
                  >
                    No items match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-3 py-2 text-[11px] text-foreground/70">
                      {item.description}
                    </td>
                    {isMaterials && (
                      <td className="px-3 py-2 text-[11px] text-muted-foreground w-28">
                        {"manufacturer" in item ? String(item.manufacturer) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-[11px] text-muted-foreground w-14">
                      {item.unit}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-right tabular-nums text-foreground/75 font-medium w-20">
                      ${(item[rateKey as keyof typeof item] as unknown as number).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-border shrink-0">
          <span className="text-[10px] text-muted-foreground/45">
            {filtered.length} of {list.length} items
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FloorProtectionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  // Client-facing: sell rates only — no cost or margin shown
  function copyClientRates() {
    const body = FLOOR_PROTECTION_CLIENT_RATES.map((r) => [r.product, `$${r.rate.toFixed(2)}`]);
    copyTableToClipboard(["Floor protection", "Supply & install ($/m², ex GST)"], body).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy the rates"),
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[640px] sm:max-w-[640px] flex flex-col gap-0 p-0 bg-card border-l border-border"
      >
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-2 pr-6">
            <SheetTitle className="text-sm font-semibold text-foreground/75">
              Floor Protection Rates
            </SheetTitle>
            <button
              onClick={copyClientRates}
              title="Copy client rates per m² (sell rates only) — pastes into Excel, Gmail or Word"
              className="inline-flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary border border-primary/30 rounded px-2 py-0.5 transition-colors"
            >
              {copied
                ? <><Check className="h-3 w-3 text-success" /> Copied</>
                : <><Clipboard className="h-3 w-3" /> Copy client rates</>}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Reference only — ex GST, not linked to any estimate.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
              <tr>
                <th className="px-3 py-1.5 w-28" />
                {FLOOR_PROTECTION_PRODUCTS.map((p) => (
                  <th
                    key={p}
                    className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FLOOR_PROTECTION_RATES.map((row) => (
                <tr key={row.label} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2 text-[11px] text-muted-foreground align-top w-28">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-3 py-2 text-[11px] align-top tabular-nums",
                        row.emphasis ? "text-foreground/75 font-medium" : "text-foreground/70"
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PriceListLinks() {
  const [open, setOpen] = useState<SheetType>(null);

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setOpen("materials")}
          className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
        >
          Material Price List
        </button>
        <button
          onClick={() => setOpen("labour")}
          className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
        >
          Labour Price List
        </button>
        <button
          onClick={() => setOpen("protection")}
          className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
        >
          Floor Protection Rates
        </button>
      </div>

      <PriceSheet type={open === "protection" ? null : open} onClose={() => setOpen(null)} />
      <FloorProtectionSheet open={open === "protection"} onClose={() => setOpen(null)} />
    </>
  );
}
