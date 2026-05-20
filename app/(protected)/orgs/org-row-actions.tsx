"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOrganization } from "./actions";

function DeleteDialog({
  orgName,
  onConfirm,
  onCancel,
  pending,
}: {
  orgName: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [input, setInput] = useState("");
  const matches = input === orgName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-black/10 dark:border-white/10 rounded-xl shadow-2xl shadow-black/40 p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground/90">Delete organization</h2>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-medium text-primary">"{orgName}"</span>{" "}
            and all its projects, estimates, takeoffs, price requests, and data. This cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Type <span className="text-primary font-semibold normal-case tracking-normal">{orgName}</span> to confirm
          </label>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) onConfirm();
              if (e.key === "Escape") onCancel();
            }}
            placeholder={orgName}
            className="w-full h-8 rounded-md border border-black/10 dark:border-white/10 bg-input px-3 text-sm text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-destructive/50 focus:border-destructive/50 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!matches || pending}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {pending ? "Deleting…" : "Delete organization"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrgRowActions({
  orgId,
  orgSlug,
  orgName,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await deleteOrganization(orgId, orgSlug);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete organization.");
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDialog(true); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showDialog && (
        <DeleteDialog
          orgName={orgName}
          onConfirm={handleDelete}
          onCancel={() => setShowDialog(false)}
          pending={pending}
        />
      )}
    </>
  );
}
