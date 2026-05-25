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
import { MoreHorizontal, CircleCheck, CircleX, Archive, ArchiveRestore, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { setProjectStatus } from "./actions";

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

  return (
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
      <DropdownMenuContent align="end" className="w-40">
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
  );
}
