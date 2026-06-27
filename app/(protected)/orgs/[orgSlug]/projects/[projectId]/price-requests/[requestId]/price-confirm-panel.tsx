"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { confirmProductPrice } from "../actions";
import type { ProductSnapshot } from "../actions";

export function PriceConfirmPanel({
  requestId,
  orgSlug,
  projectId,
  products,
}: {
  requestId: string;
  orgSlug: string;
  projectId: string;
  products: ProductSnapshot[];
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      products.map((p) => [
        p.finish_code,
        p.confirmed_price != null ? String(p.confirmed_price) : "",
      ])
    )
  );
  const [saved, setSaved] = useState<Set<string>>(
    new Set(products.filter((p) => p.confirmed_price != null).map((p) => p.finish_code))
  );
  const [, startTransition] = useTransition();

  function handleBlur(finishCode: string, raw: string) {
    const price = parseFloat(raw) || 0;
    const prev = parseFloat(prices[finishCode] || "0") || 0;
    if (price === prev && saved.has(finishCode)) return;
    startTransition(async () => {
      try {
        await confirmProductPrice(requestId, finishCode, price, orgSlug, projectId);
        setSaved((s) => {
          const next = new Set(s);
          if (price > 0) next.add(finishCode);
          else next.delete(finishCode);
          return next;
        });
      } catch {
        toast.error("Failed to save confirmed price.");
      }
    });
  }

  return (
    <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Confirm Prices
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Enter the $/unit price from the supplier&apos;s reply. Confirmed prices will appear as suggestions in the estimation sheet.
        </p>
      </div>
      <div className="divide-y divide-border">
        {products.map((p) => {
          const isSaved = saved.has(p.finish_code) && !!prices[p.finish_code];
          return (
            <div
              key={p.finish_code}
              className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <span className="text-xs font-mono font-semibold text-primary">
                  {p.finish_code}
                </span>
                {p.description && (
                  <span className="text-xs text-foreground/70 ml-2">{p.description}</span>
                )}
                {p.manufacturer && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.manufacturer}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={prices[p.finish_code] ?? ""}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [p.finish_code]: e.target.value }))
                  }
                  onBlur={(e) => handleBlur(p.finish_code, e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="w-24 text-xs text-right tabular-nums bg-input border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
                />
                <span className={`w-4 flex-shrink-0 transition-opacity ${isSaved ? "opacity-100 text-green-500" : "opacity-0"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
