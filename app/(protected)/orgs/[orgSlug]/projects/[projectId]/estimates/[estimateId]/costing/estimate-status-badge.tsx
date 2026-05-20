"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { updateEstimateStatus } from "./actions";
import { toast } from "sonner";

const STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

const STYLES: Record<Status, string> = {
  draft:     "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10 hover:bg-muted",
  submitted: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25",
  approved:  "bg-success/15 text-success border-success/30 hover:bg-success/25",
  rejected:  "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25",
};

export function EstimateStatusBadge({
  estimateId,
  initialStatus,
}: {
  estimateId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus as Status);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function select(next: Status) {
    setOpen(false);
    if (next === status) return;
    const prev = status;
    setStatus(next);
    try {
      await updateEstimateStatus(estimateId, next);
      toast.success(`Estimate marked as ${next}.`);
    } catch {
      setStatus(prev);
      toast.error("Failed to update status.");
    }
  }

  return (
    <div ref={ref} className="relative">
      <Badge
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs capitalize cursor-pointer select-none transition-colors ${STYLES[status] ?? ""}`}
      >
        {status}
      </Badge>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-black/10 dark:border-white/10 rounded-lg shadow-xl shadow-black/20 py-1 min-w-[120px]">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => select(s)}
              className={`w-full text-left px-3 py-1.5 text-xs capitalize transition-colors hover:bg-muted/50 ${
                s === status ? "text-foreground/80 font-medium" : "text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
