"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Takeoff } from "@/lib/takeoff-types";
import { NewTakeoffDialog } from "./new-takeoff-dialog";
import { ImportExcelDialog } from "./import-excel-dialog";

export function TakeoffSelector({
  takeoffs,
  selectedId,
  projectId,
  orgSlug,
  canWrite,
}: {
  takeoffs: Takeoff[];
  selectedId: string;
  projectId: string;
  orgSlug: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const selected = takeoffs.find((t) => t.id === selectedId);

  const select = (id: string) => {
    setOpen(false);
    setConfirmingId(null);
    startTransition(() => {
      router.push(`/orgs/${orgSlug}/projects/${projectId}/takeoff?takeoffId=${id}`);
    });
  };

  const handleDelete = async (t: Takeoff) => {
    setDeletingId(t.id);
    await supabase.from("takeoffs").delete().eq("id", t.id);
    setDeletingId(null);
    setConfirmingId(null);
    setOpen(false);

    // Navigate away if we just deleted the selected takeoff
    const remaining = takeoffs.filter((x) => x.id !== t.id);
    if (t.id === selectedId) {
      const next = remaining[0];
      router.push(
        next
          ? `/orgs/${orgSlug}/projects/${projectId}/takeoff?takeoffId=${next.id}`
          : `/orgs/${orgSlug}/projects/${projectId}/takeoff`
      );
    }
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-sm",
              "bg-card/65 hover:bg-muted/40 transition-colors min-w-[320px]"
            )}
          >
            <span className="flex-1 text-left truncate text-foreground/70">
              {selected?.name ?? "Select takeoff"}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirmingId(null); }} />
              <div className="absolute top-full left-0 mt-1 z-50 min-w-full bg-card border border-border rounded-sm shadow-xl shadow-black/30 overflow-hidden">
                {takeoffs.map((t) => (
                  <div key={t.id} className="group relative">
                    {confirmingId === t.id ? (
                      /* Inline delete confirmation */
                      <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10">
                        <span className="flex-1 text-xs text-destructive">Delete "{t.name}"?</span>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t.id}
                          className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                        >
                          {deletingId === t.id ? "Deleting…" : "Yes"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => select(t.id)}
                        className={cn(
                          "w-full text-left px-3 py-1 text-xs hover:bg-muted/40 transition-colors flex items-center gap-2",
                          t.id === selectedId ? "text-primary bg-primary/5" : "text-foreground/70"
                        )}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        {canWrite && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmingId(t.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-all shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </button>
                    )}
                  </div>
                ))}
                {takeoffs.length === 0 && (
                  <p className="px-3 py-1 text-xs text-muted-foreground">No takeoffs yet</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* New takeoff */}
        {canWrite && (
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-sm hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        )}

        {/* Import */}
        {canWrite && (
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-sm hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Import
          </button>
        )}

        {/* Delete current takeoff */}
        {canWrite && selected && (
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-sm hover:bg-destructive/10 hover:border-destructive/40 transition-colors text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}

        <Loader2 className={`h-3.5 w-3.5 shrink-0 text-primary/70 transition-opacity ${isPending ? "animate-spin opacity-100" : "opacity-0"}`} />
      </div>

      <NewTakeoffDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        orgSlug={orgSlug}
        nextSortOrder={takeoffs.length}
      />

      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        orgSlug={orgSlug}
        existingTakeoffCount={takeoffs.length}
      />

      {/* Delete confirmation modal */}
      {selected && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete takeoff?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/70">"{selected.name}"</span> and all its rows will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deletingId === selected.id}
                onClick={async () => {
                  await handleDelete(selected);
                  setDeleteModalOpen(false);
                }}
              >
                {deletingId === selected.id ? "Deleting…" : "Delete takeoff"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
