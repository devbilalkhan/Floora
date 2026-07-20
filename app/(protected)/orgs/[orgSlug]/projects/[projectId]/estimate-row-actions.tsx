"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Trash2, ShieldCheck, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { deleteEstimate, duplicateEstimate, renameEstimate } from "./actions";

export function EstimateRowActions({
  estimateId,
  estimateName,
  projectId,
  orgSlug,
  canManageEstimates,
}: {
  estimateId: string;
  estimateName: string;
  projectId: string;
  orgSlug: string;
  canManageEstimates: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameValue, setNameValue] = useState(estimateName);

  async function handleDelete() {
    setPending(true);
    try {
      await deleteEstimate(estimateId, projectId, orgSlug);
      toast.success("Estimate deleted.");
      router.refresh();
    } catch {
      toast.error("Failed to delete estimate.");
    } finally {
      setPending(false);
    }
  }

  async function handleDuplicate() {
    setPending(true);
    try {
      await duplicateEstimate(estimateId, projectId, orgSlug, `${estimateName} (Copy)`);
      toast.success("Estimate duplicated.");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate estimate.");
    } finally {
      setPending(false);
    }
  }

  async function handleRename() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === estimateName) { setRenameOpen(false); return; }
    setPending(true);
    try {
      await renameEstimate(estimateId, projectId, orgSlug, trimmed);
      toast.success("Estimate renamed.");
      router.refresh();
      setRenameOpen(false);
    } catch {
      toast.error("Failed to rename estimate.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            disabled={pending}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="gap-2 text-sm cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/swms`);
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Open SWMS
          </DropdownMenuItem>
          {canManageEstimates && (
            <>
              <DropdownMenuItem
                className="gap-2 text-sm cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameValue(estimateName);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-sm cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-sm text-destructive cursor-pointer focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="estimate-name">Name</Label>
            <Input
              id="estimate-name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={handleRename} disabled={pending || !nameValue.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the estimate and all its line items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
