"use client";

import { useState, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkupViewer } from "./markup-viewer";

interface LoadedFile {
  name: string;
  url: string;
}

export function MarkupControl() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList) {
    const pdfs = Array.from(fileList).filter(f => f.type === "application/pdf");
    if (pdfs.length === 0) return;
    const entries = pdfs.map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
    const firstNewIndex = files.length;
    setFiles([...files, ...entries]);
    setActiveIndex(activeIndex === null ? firstNewIndex : activeIndex);
    setOpen(true);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(files[index].url);
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    if (activeIndex === index) setActiveIndex(next.length > 0 ? 0 : null);
    else if (activeIndex !== null && index < activeIndex) setActiveIndex(activeIndex - 1);
  }

  function handleTriggerClick() {
    if (files.length > 0) {
      setOpen(true);
    } else {
      inputRef.current?.click();
    }
  }

  return (
    <>
      {/* Trigger button — styled like Print Report */}
      <button
        onClick={handleTriggerClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted/40 transition-colors shrink-0"
      >
        <FileText className="h-3.5 w-3.5" />
        Markups
        {files.length > 0 && (
          <span className="ml-0.5 h-4 min-w-4 flex items-center justify-center rounded-full text-[10px] tabular-nums bg-primary/15 text-primary border border-primary/30 px-1">
            {files.length}
          </span>
        )}
      </button>

      {/* Hidden file input — shared between trigger and modal's "Add PDF" */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Modal */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "w-[95vw] max-w-6xl h-[90vh] flex flex-col",
              "bg-card/85 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 overflow-hidden",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
          >
            <DialogPrimitive.Title className="sr-only">Markups</DialogPrimitive.Title>

            {/* Header */}
            <div
              className="flex items-center gap-2 px-4 h-11 border-b border-white/[0.06] bg-muted/20 shrink-0"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); }}
            >
              <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide shrink-0">
                Markups
              </span>

              {/* File chips */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                {files.map((f, i) => (
                  <button
                    key={f.url}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "group flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm border text-xs transition-colors shrink-0",
                      activeIndex === i
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/30 border-border text-foreground/60 hover:bg-muted/50"
                    )}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); removeFile(i); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); removeFile(i); } }}
                      className="opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ))}

                {/* Add PDF chip */}
                <div
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm border border-dashed text-xs cursor-pointer transition-colors shrink-0",
                    isDragOver
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground/60"
                  )}
                >
                  <Upload className="h-3 w-3" />
                  <span>Add PDF</span>
                </div>
              </div>

              {/* Close */}
              <DialogPrimitive.Close className="flex items-center justify-center h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors shrink-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden">
              {activeIndex !== null && files[activeIndex] ? (
                <MarkupViewer
                  key={files[activeIndex].url}
                  url={files[activeIndex].url}
                  fileName={files[activeIndex].name}
                />
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "h-full flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
                    isDragOver ? "bg-primary/5" : "hover:bg-muted/[0.07]"
                  )}
                >
                  <Upload className={cn("h-10 w-10", isDragOver ? "text-primary" : "text-muted-foreground")} />
                  <p className="text-sm text-muted-foreground">Drop a PDF here or click to browse</p>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
