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
import { MoreHorizontal, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { deleteEstimate } from "./actions";

export function EstimateRowActions({
  estimateId,
  projectId,
  orgSlug,
  canManageEstimates,
}: {
  estimateId: string;
  projectId: string;
  orgSlug: string;
  canManageEstimates: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

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
            <DropdownMenuItem
              className="gap-2 text-sm text-destructive cursor-pointer focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={open} onOpenChange={setOpen}>
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
