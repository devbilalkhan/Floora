"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectOption = {
  id: string;
  name: string;
  location: string | null;
  head_client: string | null;
};

export function ProjectQuickSearch({
  orgSlug,
  projects,
}: {
  orgSlug: string;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const matches = q
    ? projects
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.location?.toLowerCase().includes(q) ||
            p.head_client?.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(id: string) {
    router.push(`/orgs/${orgSlug}/projects/${id}`);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(matches[activeIndex].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-input px-2 h-6 w-72 focus-within:ring-1 focus-within:ring-primary/40">
        <Search className="h-3 w-3 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to project…"
          className="bg-transparent text-[11px] text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none w-full min-w-0"
        />
      </div>

      {open && q && (
        <div className="absolute left-0 top-full mt-1 w-72 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-50">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              No projects match &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            matches.map((p, i) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  goTo(p.id);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors",
                  i === activeIndex ? "bg-muted/60" : "hover:bg-muted/40"
                )}
              >
                <span className="text-xs font-medium text-foreground/80 truncate">{p.name}</span>
                {(p.location || p.head_client) && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {[p.location, p.head_client].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
