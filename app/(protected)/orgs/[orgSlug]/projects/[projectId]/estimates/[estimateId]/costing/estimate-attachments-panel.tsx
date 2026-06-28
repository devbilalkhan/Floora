"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  FileText, FileSpreadsheet, FileImage, File,
  Upload, Trash2, Eye, Download, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  uploadEstimateAttachment,
  getEstimateAttachmentUrl,
  deleteEstimateAttachment,
  type EstimateAttachment,
} from "./actions";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv")
    return <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" />;
  if (mimeType.startsWith("image/"))
    return <FileImage className="h-3.5 w-3.5 shrink-0 text-blue-500/70" />;
  if (mimeType === "application/pdf")
    return <FileText className="h-3.5 w-3.5 shrink-0 text-red-500/70" />;
  return <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />;
}

const isPdf = (mime: string) => mime === "application/pdf";

export function EstimateAttachmentsPanel({
  estimateId,
  projectId,
  initialAttachments,
}: {
  estimateId: string;
  projectId: string;
  initialAttachments: EstimateAttachment[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<EstimateAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const att = await uploadEstimateAttachment(estimateId, projectId, fd);
      setAttachments((prev) => [att, ...prev]);
      toast.success(`"${att.name}" attached.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleOpen(att: EstimateAttachment) {
    setLoadingUrl(true);
    try {
      const url = await getEstimateAttachmentUrl(att.id, estimateId);
      if (isPdf(att.mime_type)) {
        setViewerId(att.id);
        setViewerUrl(url);
      } else {
        window.open(url, "_blank");
      }
    } catch {
      toast.error("Failed to open file.");
    } finally {
      setLoadingUrl(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteEstimateAttachment(id, estimateId);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (viewerId === id) { setViewerId(null); setViewerUrl(null); }
      toast.success("Attachment deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const viewerAtt = attachments.find((a) => a.id === viewerId);

  return (
    <div className="bg-card/65 backdrop-blur-xl border border-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-primary/60 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Attachments
          </span>
          {attachments.length > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/50">
              ({attachments.length})
            </span>
          )}
        </div>
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.webp,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {uploading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Attach file"}
          </button>
        </>
      </div>

      {/* List */}
      {attachments.length === 0 ? (
        <div
          className="py-6 text-center border-2 border-dashed border-border/40 m-3 rounded-sm cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/30" />
          <p className="text-[11px] text-muted-foreground/50">
            Drop or click to attach a file
          </p>
          <p className="text-[10px] text-muted-foreground/35 mt-0.5">
            PDF · Excel · Word · Image · CSV — max 20 MB
          </p>
        </div>
      ) : (
        <TooltipProvider delayDuration={400}>
          <div className="divide-y divide-border/40">
            {attachments.map((att) => {
              if (confirmDeleteId === att.id) {
                return (
                  <div key={att.id} className="flex items-center gap-2 px-4 py-2 bg-destructive/5">
                    <span className="flex-1 min-w-0 text-[11px] text-destructive truncate">
                      Delete &ldquo;{att.name}&rdquo;?
                    </span>
                    <button
                      onClick={() => handleDelete(att.id)}
                      disabled={deleting}
                      className="text-[11px] font-medium text-destructive hover:text-destructive/70 shrink-0"
                    >
                      {deleting ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                    >
                      No
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={att.id}
                  className="group flex items-center gap-2.5 px-4 py-2 hover:bg-accent/40 transition-colors"
                >
                  <FileIcon mimeType={att.mime_type} />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleOpen(att)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="block text-[11px] text-foreground/70 hover:text-foreground transition-colors truncate">
                          {att.name}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs break-all">{att.name}</p>
                    </TooltipContent>
                  </Tooltip>

                  <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                    {formatBytes(att.size_bytes)}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleOpen(att)}
                          disabled={loadingUrl}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                        >
                          {isPdf(att.mime_type)
                            ? <Eye className="h-3 w-3" />
                            : <Download className="h-3 w-3" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">{isPdf(att.mime_type) ? "View" : "Open / download"}</p>
                      </TooltipContent>
                    </Tooltip>
                    <button
                      onClick={() => setConfirmDeleteId(att.id)}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* PDF viewer modal */}
      <Dialog
        open={viewerId !== null}
        onOpenChange={(open) => { if (!open) { setViewerId(null); setViewerUrl(null); } }}
      >
        <DialogContent className="w-[80vw] max-w-[80vw] h-[90vh] bg-card/85 backdrop-blur-xl flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium truncate pr-6">
              {viewerAtt?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-sm overflow-hidden border border-border">
            {!viewerUrl ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe src={viewerUrl} className="w-full h-full border-0" title="Attachment viewer" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
