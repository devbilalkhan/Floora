"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { updateEstimateNotes } from "./actions";

const NotesEditor = dynamic(
  () => import("./notes-editor").then((m) => m.NotesEditor),
  { ssr: false, loading: () => <div className="min-h-[140px]" /> }
);

export function EstimateNotesPanel({
  estimateId,
  initialNotes,
}: {
  estimateId: string;
  initialNotes: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (notes: string) => {
    setStatus("saving");
    try {
      await updateEstimateNotes(estimateId, notes);
      setStatus("saved");
    } catch {
      toast.error("Failed to save notes.");
      setStatus("idle");
    }
  }, [estimateId]);

  function schedule(next: string) {
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current !== null) save(pending.current);
      pending.current = null;
      timer.current = null;
    }, 600);
  }

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current !== null) {
      save(pending.current);
      pending.current = null;
    }
  }

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  return (
    <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-primary/60 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Notes
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/50">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>

      <NotesEditor
        initialContent={initialNotes ?? ""}
        onChange={(html) => {
          setStatus("idle");
          schedule(html);
        }}
        onBlur={flush}
      />
    </div>
  );
}
