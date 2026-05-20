"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteProject } from "@/app/(protected)/orgs/[orgSlug]/projects/actions";

function DeleteDialog({
  projectName,
  onConfirm,
  onCancel,
  pending,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [input, setInput] = useState("");
  const matches = input === projectName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-black/10 dark:border-white/10 rounded-xl shadow-2xl shadow-black/40 p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground/90">Delete project</h2>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-medium text-primary">"{projectName}"</span>{" "}
            and all associated data — takeoffs, estimates, SWMS, price requests, and drawings. This cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Type <span className="text-primary font-semibold normal-case tracking-normal">{projectName}</span> to confirm
          </label>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) onConfirm();
              if (e.key === "Escape") onCancel();
            }}
            placeholder={projectName}
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
            {pending ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeleteProjectZone({
  projectId,
  projectName,
  orgSlug,
}: {
  projectId: string;
  projectName: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await deleteProject(projectId, orgSlug);
      toast.success("Project deleted.");
      router.push(`/orgs/${orgSlug}/projects`);
    } catch {
      toast.error("Failed to delete project.");
      setPending(false);
    }
  }

  return (
    <>
      <div className="border border-red-900/25 dark:border-red-500/15 rounded-xl p-4 space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-destructive/80">Danger zone</h3>
          <p className="text-xs text-muted-foreground">
            Permanently delete this project and all its data. This action cannot be reversed.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDialog(true)}
          className="border-red-500/50 text-red-500 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete this project
        </Button>
      </div>

      {showDialog && (
        <DeleteDialog
          projectName={projectName}
          onConfirm={handleDelete}
          onCancel={() => setShowDialog(false)}
          pending={pending}
        />
      )}
    </>
  );
}
