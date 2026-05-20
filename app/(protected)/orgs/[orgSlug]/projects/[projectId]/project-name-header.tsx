"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { renameProject } from "./actions";

export function ProjectNameHeader({
  projectId,
  orgSlug,
  initialName,
  canWrite,
}: {
  projectId: string;
  orgSlug: string;
  initialName: string;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (!canWrite) {
    return <h1 className="text-xl font-semibold">{name}</h1>;
  }

  const commit = async () => {
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === initialName) {
      setName(initialName);
      return;
    }
    try {
      await renameProject(projectId, orgSlug, trimmed);
      toast.success("Project renamed.");
    } catch {
      setName(initialName);
      toast.error("Failed to rename project.");
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setName(initialName); setEditing(false); }
        }}
        className="text-xl font-semibold bg-transparent border-b border-primary/50 outline-none w-full max-w-sm py-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2"
    >
      <h1 className="text-xl font-semibold">{name}</h1>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
