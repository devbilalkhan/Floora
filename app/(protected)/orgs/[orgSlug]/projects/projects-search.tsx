"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

export function ProjectsSearch({
  initialValue,
  basePath,
}: {
  initialValue: string;
  basePath: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  // debouncing covers the wait before navigating; isPending covers the server round-trip
  const [debouncing, setDebouncing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const loading = debouncing || isPending;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the server re-renders with new results, initialValue updates — sync without remounting
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleChange(v: string) {
    setValue(v);
    setDebouncing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const qs = new URLSearchParams();
      if (v.trim()) qs.set("q", v.trim());
      const str = qs.toString();
      startTransition(() => {
        setDebouncing(false);
        router.push(str ? `${basePath}?${str}` : basePath);
      });
    }, 350);
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder="Search projects…"
        className="h-10 pl-9 pr-8 text-[12px] bg-input border border-border rounded-md text-foreground/70 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 w-full"
      />
      {loading ? (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        </span>
      ) : value && (
        <button
          onClick={() => handleChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
