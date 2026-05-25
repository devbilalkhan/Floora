"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { CheckSquare2, Square, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type PickerProject = {
  id: string;
  name: string;
  head_client: string | null;
  brand: string;
  status: string;
};

export function ProjectPicker({
  projects,
  selectedIds,
  onApply,
}: {
  projects: PickerProject[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.head_client ?? "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    onApply(Array.from(next));
  }

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-muted/40">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex-1">
          Select projects to consolidate
        </span>
        {checked.size > 0 && (
          <span className="text-[10px] font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
            {checked.size} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-black/10 dark:border-white/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects or client…"
            className="pl-7 h-7 text-xs bg-card/40 border-black/10 dark:border-white/10 placeholder:text-muted-foreground/45"
          />
        </div>
      </div>

      {/* Project list */}
      <div className="max-h-[260px] overflow-y-auto divide-y divide-black/[0.05] dark:divide-white/[0.05]">
        {filtered.map((p) => {
          const isChecked = checked.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1 text-left transition-colors hover:bg-muted/40",
                isChecked && "bg-primary/5"
              )}
            >
              {isChecked ? (
                <CheckSquare2 className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={cn(
                  "text-xs flex-1 truncate",
                  isChecked ? "text-primary" : "text-foreground/70"
                )}
              >
                {p.name}
              </span>
              {p.head_client && (
                <span className="hidden sm:block text-[11px] text-muted-foreground truncate max-w-[160px]">
                  {p.head_client}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/45 shrink-0">
                {p.brand === "dfo" ? "DFO" : "SPM"}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-1 text-xs text-muted-foreground">
            {query ? `No projects match "${query}"` : "No projects found"}
          </p>
        )}
      </div>
    </div>
  );
}
