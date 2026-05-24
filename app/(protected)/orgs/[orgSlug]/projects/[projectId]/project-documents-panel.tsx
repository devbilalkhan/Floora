"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Eye, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { uploadProjectDocument, getProjectDocumentUrl, deleteProjectDocument } from "./actions";

type Doc = {
  id: string;
  name: string;
  size_bytes: number | null;
  created_at: string;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentsPanel({
  projectId,
  orgSlug,
  canWrite,
  initialDocs,
}: {
  projectId: string;
  orgSlug: string;
  canWrite: boolean;
  initialDocs: Doc[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const doc = await uploadProjectDocument(projectId, orgSlug, fd);
      setDocs((prev) => [doc, ...prev]);
      toast.success(`"${doc.name}" uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleView(doc: Doc) {
    setActiveDocId(doc.id);
    setViewerUrl(null);
    setLoadingUrl(true);
    try {
      const url = await getProjectDocumentUrl(doc.id, projectId);
      setViewerUrl(url);
    } catch {
      toast.error("Failed to load document.");
      setActiveDocId(null);
    } finally {
      setLoadingUrl(false);
    }
  }

  function handleCloseViewer() {
    setActiveDocId(null);
    setViewerUrl(null);
  }

  async function handleDelete(docId: string) {
    setDeleting(true);
    try {
      await deleteProjectDocument(docId, projectId, orgSlug);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (activeDocId === docId) handleCloseViewer();
      toast.success("Document deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const activeDoc = docs.find((d) => d.id === activeDocId);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Documents
        </span>
        {canWrite && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Upload PDF"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            >
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>

      <div className="border-t border-border/60" />

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[11px] text-muted-foreground/50">No documents uploaded</p>
        </div>
      ) : (
        <TooltipProvider delayDuration={400}>
          <div className="divide-y divide-border/40 max-h-64 overflow-y-auto">
            {docs.map((doc) => {
              if (confirmDeleteId === doc.id) {
                return (
                  <div key={doc.id} className="flex items-center gap-2 px-3 py-2 bg-destructive/5">
                    <span className="flex-1 min-w-0 text-[11px] text-destructive truncate">
                      Delete &ldquo;{doc.name}&rdquo;?
                    </span>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting}
                      className="text-[11px] font-medium text-destructive hover:text-destructive/70 transition-colors shrink-0"
                    >
                      {deleting ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      No
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={doc.id}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => handleView(doc)} className="flex-1 min-w-0 text-left">
                        <span className="block text-[11px] text-foreground/70 hover:text-foreground transition-colors truncate">
                          {doc.name}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs break-all">{doc.name}</p>
                    </TooltipContent>
                  </Tooltip>

                  <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                    {formatBytes(doc.size_bytes)}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleView(doc)}
                      title="View PDF"
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    {canWrite && (
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        title="Delete"
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* PDF viewer modal */}
      <Dialog open={activeDocId !== null} onOpenChange={(open) => { if (!open) handleCloseViewer(); }}>
        <DialogContent className="w-[80vw] max-w-[80vw] h-[90vh] bg-card/85 backdrop-blur-xl flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium truncate pr-6">
              {activeDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-sm overflow-hidden border border-border">
            {loadingUrl ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : viewerUrl ? (
              <iframe src={viewerUrl} className="w-full h-full border-0" title="Document viewer" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
