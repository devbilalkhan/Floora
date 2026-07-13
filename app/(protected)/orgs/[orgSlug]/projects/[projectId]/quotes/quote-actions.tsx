"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MoreHorizontal, Pencil, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { deleteQuote, updateQuoteStatus, renameQuote, copyQuoteToProject } from "../estimates/[estimateId]/quote/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["draft", "sent", "accepted", "declined"] as const;

export function QuoteActions({
  quoteId,
  orgSlug,
  projectId,
  currentStatus,
  currentName,
  otherProjects,
}: {
  quoteId: string;
  orgSlug: string;
  projectId: string;
  currentStatus: string;
  currentName?: string;
  otherProjects?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(currentName ?? "");
  const [deleting, setDeleting] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetId, setCopyTargetId] = useState("");
  const [copying, setCopying] = useState(false);

  function close() {
    setOpen(false);
    setRenaming(false);
  }

  function handleDelete() {
    setDeleting(true);
    startTransition(async () => {
      try {
        await deleteQuote(orgSlug, projectId, quoteId);
        toast.success("Quote deleted.");
        router.refresh();
        close();
      } catch {
        toast.error("Failed to delete quote.");
        setDeleting(false);
        close();
      }
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
      close();
    });
  }

  async function handleCopy() {
    if (!copyTargetId) return;
    setCopying(true);
    try {
      const result = await copyQuoteToProject(orgSlug, quoteId, copyTargetId);
      toast.success("Quote copied.");
      setCopyDialogOpen(false);
      close();
      router.push(`/orgs/${orgSlug}/projects/${result.projectId}/quotes/${result.id}`);
    } catch {
      toast.error("Failed to copy quote.");
      setCopying(false);
    }
  }

  function handleRename() {
    startTransition(async () => {
      try {
        await renameQuote(quoteId, nameInput.trim(), orgSlug, projectId);
        router.refresh();
        toast.success("Quote renamed.");
      } catch {
        toast.error("Failed to rename quote.");
      }
      close();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setRenaming(false); }}
        disabled={deleting}
        className={`transition-opacity p-1 rounded-sm text-muted-foreground hover:text-foreground ${
          deleting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-black/10 dark:border-white/10 rounded-sm shadow-xl shadow-black/30 overflow-hidden">
            {renaming ? (
              <div className="px-2 py-2 space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Rename quote</div>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  placeholder="Quote name"
                  className="w-full text-[11px] border border-border rounded px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleRename}
                    disabled={isPending}
                    className="flex-1 text-[10px] bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setRenaming(false)}
                    className="flex-1 text-[10px] border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setRenaming(true)}
                  className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted/40 transition-colors flex items-center gap-1.5 border-b border-black/10 dark:border-white/10"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                  Rename
                </button>
                {otherProjects && otherProjects.length > 0 && (
                  <button
                    onClick={() => { setCopyTargetId(""); setCopyDialogOpen(true); close(); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted/40 transition-colors flex items-center gap-1.5 border-b border-black/10 dark:border-white/10"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                    Copy to project…
                  </button>
                )}
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
                    className="w-full text-left px-3 py-1 text-[11px] text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {deleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <Dialog open={copyDialogOpen} onOpenChange={(next) => { if (!copying) setCopyDialogOpen(next); }}>
        <DialogContent className="sm:max-w-sm bg-card/85 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Copy quote to project</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Creates a new draft quote in the target project with the same line items, client
            and company details. It won&apos;t be linked to that project&apos;s estimate.
          </p>
          <Select value={copyTargetId} onValueChange={setCopyTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project…" />
            </SelectTrigger>
            <SelectContent>
              {(otherProjects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCopyDialogOpen(false)} disabled={copying}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleCopy} disabled={!copyTargetId || copying}>
              {copying ? "Copying…" : "Copy quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
