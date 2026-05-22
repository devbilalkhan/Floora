"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Bold, List } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarBtn({
  active,
  onAction,
  title,
  children,
}: {
  active: boolean;
  onAction: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // preventDefault keeps focus inside the editor when clicking toolbar
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      title={title}
      className={cn(
        "p-1 rounded transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}

export function RichEditor({
  value,
  onChange,
  rows = 4,
}: {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Track toolbar active states on selection change
  const [isBold, setIsBold] = useState(false);
  const [isList, setIsList] = useState(false);

  // Set initial HTML once on mount only — do not sync from value afterwards
  // (would reset cursor position on every keystroke)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateToolbarState = useCallback(() => {
    try {
      setIsBold(document.queryCommandState("bold"));
      setIsList(document.queryCommandState("insertUnorderedList"));
    } catch {
      // queryCommandState may throw in some environments
    }
  }, []);

  const emit = useCallback(() => {
    onChange(editorRef.current?.innerHTML ?? "");
  }, [onChange]);

  function execCmd(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    emit();
    updateToolbarState();
  }

  return (
    <div className="bg-background/60 border border-border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/20">
        <ToolbarBtn active={isBold} onAction={() => execCmd("bold")} title="Bold">
          <Bold className="h-3 w-3" />
        </ToolbarBtn>
        <ToolbarBtn active={isList} onAction={() => execCmd("insertUnorderedList")} title="Bullet list">
          <List className="h-3 w-3" />
        </ToolbarBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={updateToolbarState}
        onMouseUp={updateToolbarState}
        onSelect={updateToolbarState}
        style={{ minHeight: `${rows * 1.6}rem` }}
        className={cn(
          "px-3 py-1.5 text-[11px] leading-relaxed text-foreground focus:outline-none",
          "[&_ul]:pl-4 [&_ul]:list-disc [&_ul]:space-y-0.5",
          "[&_b]:font-semibold [&_strong]:font-semibold",
          // Placeholder via CSS when empty
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none empty:before:float-left"
        )}
        data-placeholder="Describe your capabilities…"
      />
    </div>
  );
}
