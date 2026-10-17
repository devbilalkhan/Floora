"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { copyTableToClipboard } from "@/lib/copy-table";

// Client-facing floor prep rates — editable per visit, not saved and not linked to the estimate
const DEFAULTS = [
  { key: "flood", label: "Self levelling / Flooding", unit: "bag", rate: 105 },
  { key: "grind", label: "Grinding", unit: "m²", rate: 15 },
];

export function FloorPrepClientRates() {
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(DEFAULTS.map((d) => [d.key, String(d.rate)]))
  );
  const [copied, setCopied] = useState(false);

  function copy() {
    const body = DEFAULTS.map((d) => [d.label, `$${(parseFloat(rates[d.key]) || 0).toFixed(2)} / ${d.unit}`]);
    copyTableToClipboard(["Floor preparation", "Rate (ex GST)"], body).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy the rates"),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      <span className="text-muted-foreground">Floor prep rates</span>
      {DEFAULTS.map((d) => (
        <label key={d.key} className="flex items-center gap-1 text-foreground/70">
          {d.label}
          <span className="text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={rates[d.key]}
            onChange={(e) => setRates((r) => ({ ...r, [d.key]: e.target.value }))}
            className="w-16 px-1.5 py-0.5 text-right tabular-nums bg-input border border-border rounded text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="text-muted-foreground">/ {d.unit}</span>
        </label>
      ))}
      <button
        onClick={copy}
        title="Copy floor prep rates as a table — pastes into Excel, Gmail or Word"
        className="inline-flex items-center gap-1 text-primary/80 hover:text-primary border border-primary/30 rounded px-2 py-0.5 transition-colors"
      >
        {copied
          ? <><Check className="h-3 w-3 text-success" /> Copied</>
          : <><Clipboard className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );
}
