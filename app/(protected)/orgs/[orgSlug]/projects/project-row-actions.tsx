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
import { MoreHorizontal, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { setProjectStatus } from "./actions";

export function ProjectRowActions({
  projectId,
  orgSlug,
  currentStatus,
}: {
  projectId: string;
  orgSlug: string;
  currentStatus: "active" | "archived";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleStatus() {
    setPending(true);
    try {
      await setProjectStatus(
        projectId,
        orgSlug,
        currentStatus === "active" ? "archived" : "active"
      );
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
        <DropdownMenuItem
          className="gap-2 text-sm cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            toggleStatus();
          }}
        >
          {currentStatus === "active" ? (
            <>
              <Archive className="h-3.5 w-3.5" /> Archive
            </>
          ) : (
            <>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
