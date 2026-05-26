"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, CircleCheck, CircleX, Archive, CircleDot, Copy } from "lucide-react";
import { toast } from "sonner";
import { setProjectStatus, duplicateProject } from "./actions";

type ProjectStatus = "active" | "archived" | "completed" | "rejected";

const STATUS_OPTIONS: { value: ProjectStatus; label: string; icon: React.ReactNode }[] = [
  { value: "active",    label: "Active",    icon: <CircleDot className="h-3.5 w-3.5" /> },
  { value: "completed", label: "Completed", icon: <CircleCheck className="h-3.5 w-3.5" /> },
  { value: "rejected",  label: "Rejected",  icon: <CircleX className="h-3.5 w-3.5" /> },
  { value: "archived",  label: "Archived",  icon: <Archive className="h-3.5 w-3.5" /> },
];

export function ProjectRowActions({
  projectId,
  projectName,
  orgSlug,
  currentStatus,
}: {
  projectId: string;
  projectName: string;
  orgSlug: string;
  currentStatus: ProjectStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dupName, setDupName] = useState("");

  async function changeStatus(next: ProjectStatus) {
    if (next === currentStatus) return;
    setPending(true);
    try {
      await setProjectStatus(projectId, orgSlug, next);
      toast.success(`Project marked as ${next}.`);
      router.refresh();
    } catch {
      toast.error("Failed to update project status.");
    } finally {
      setPending(false);
    }
  }

  function openDuplicate() {
    setDupName(`${projectName} (Copy)`);
    setDuplicateOpen(true);
  }

  async function handleDuplicate() {
    const name = dupName.trim();
    if (!name) return;
    setPending(true);
    setDuplicateOpen(false);
    const toastId = toast.loading("Duplicating project…");
    try {
      const { projectId: newId } = await duplicateProject(projectId, orgSlug, name);
      toast.success("Project duplicated.", { id: toastId });
      router.push(`/orgs/${orgSlug}/projects/${newId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to duplicate project.",
        { id: toastId }
      );
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
            onClick={(e) => { e.stopPropagation(); openDuplicate(); }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Set status
          </div>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              className="gap-2 text-sm cursor-pointer"
              disabled={opt.value === currentStatus}
              onClick={(e) => { e.stopPropagation(); changeStatus(opt.value); }}
            >
              {opt.icon}
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Duplicate project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">New project name</Label>
              <Input
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDuplicate(); }}
                className="text-sm"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Copies estimates, takeoffs, and SWMS documents.
              Drawings, actuals, quotes, and tasks are not copied.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDuplicate} disabled={!dupName.trim() || pending}>
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
