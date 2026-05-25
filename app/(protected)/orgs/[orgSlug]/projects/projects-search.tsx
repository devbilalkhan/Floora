"use client";

import { useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the server re-renders with new results, initialValue updates — clear loader without remounting
  useEffect(() => {
    setValue(initialValue);
    setLoading(false);
  }, [initialValue]);

  function handleChange(v: string) {
    setValue(v);
    setLoading(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(true);
      const qs = new URLSearchParams();
      if (v.trim()) qs.set("q", v.trim());
      const str = qs.toString();
      router.push(str ? `${basePath}?${str}` : basePath);
    }, 350);
  }

  return (
    <div className="relative">
      {loading ? (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground/50 animate-spin" />
        </span>
      ) : (
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
      )}
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder="Search projects…"
        className="h-8 pl-8 pr-7 text-[11px] bg-input border border-border rounded-md text-foreground/70 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 w-52"
      />
      {value && (
        <button
          onClick={() => handleChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
