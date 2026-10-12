"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { updateProtectionNotes } from "../actions";

// TipTap is lazy-loaded (project rule: rich text editors via dynamic(), ssr: false)
const NotesEditor = dynamic(() => import("@/components/notes-editor").then((m) => m.NotesEditor), {
  ssr: false,
  loading: () => <Skeleton className="m-3 h-[240px]" />,
});

const SAVE_DELAY_MS = 800;

/**
 * Autosaving rich-text notes for a protection estimate (Costing summary tab).
 * `notesRef` lives in the parent so the latest text survives the tab unmounting.
 */
export function ProtectionNotesPanel({
  estimateId,
  notesRef,
}: {
  estimateId: string;
  notesRef: MutableRefObject<string | null>;
}) {
  const [status, setStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(html: string) {
    setStatus("saving");
    try {
      // An emptied editor is "<p></p>" — store it as no notes
      await updateProtectionNotes(estimateId, html === "<p></p>" ? "" : html);
      setStatus(pending.current === null ? "saved" : "unsaved");
    } catch {
      toast.error("Failed to save notes.");
      setStatus("unsaved");
    }
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      const html = pending.current;
      pending.current = null;
      save(html);
    }
  }

  // Save on unmount (e.g. switching tabs) and warn before leaving with unsaved notes
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "unsaved" && status !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return (
    <section className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Notes</p>
        <span className="text-[10px] text-muted-foreground/60">
          {status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <div className="border-t border-black/10 dark:border-white/10">
        <NotesEditor
          variant="full"
          placeholder="Scope, assumptions, exclusions, supplier quotes, site notes…"
          initialContent={notesRef.current ?? ""}
          onChange={(html) => {
            notesRef.current = html;
            pending.current = html;
            setStatus("unsaved");
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(flush, SAVE_DELAY_MS);
          }}
          onBlur={flush}
        />
      </div>
    </section>
  );
}
