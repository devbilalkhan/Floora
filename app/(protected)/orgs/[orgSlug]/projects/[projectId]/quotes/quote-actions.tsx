"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { deleteQuote, updateQuoteStatus } from "../estimates/[estimateId]/quote/actions";

const STATUSES = ["draft", "sent", "accepted", "declined"] as const;

export function QuoteActions({
  quoteId,
  orgSlug,
  projectId,
  currentStatus,
}: {
  quoteId: string;
  orgSlug: string;
  projectId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteQuote(orgSlug, projectId, quoteId);
        toast.success("Quote deleted.");
        router.refresh();
      } catch {
        toast.error("Failed to delete quote.");
      }
      setOpen(false);
    });
  }

  function handleStatus(status: string) {
    startTransition(async () => {
      try {
        await updateQuoteStatus(quoteId, status, orgSlug, projectId);
        router.refresh();
      } catch {
        toast.error("Failed to update status.");
      }
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-card border border-black/10 dark:border-white/10 rounded-sm shadow-xl shadow-black/30 overflow-hidden">
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b border-black/10 dark:border-white/10">
              Set status
            </div>
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={s === currentStatus || isPending}
                onClick={() => handleStatus(s)}
                className="w-full text-left px-3 py-1 text-[11px] capitalize hover:bg-muted/40 transition-colors disabled:text-muted-foreground/40"
              >
                {s}
              </button>
            ))}
            <div className="border-t border-black/10 dark:border-white/10">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="w-full text-left px-3 py-1 text-[11px] text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
