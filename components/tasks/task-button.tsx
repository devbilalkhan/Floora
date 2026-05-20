"use client";

import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-provider";
import { CheckSquare2 } from "lucide-react";

export function TaskButton() {
  const { open, setOpen } = useTaskPanel();

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        open
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <CheckSquare2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline font-medium">Tasks</span>
      <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted/80 px-1 py-px text-[10px] font-mono leading-none text-muted-foreground">
        ⌘J
      </kbd>
    </button>
  );
}
