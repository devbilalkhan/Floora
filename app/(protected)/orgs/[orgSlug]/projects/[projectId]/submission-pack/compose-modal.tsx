"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Mail, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  filename: string;
  hasGmail: boolean;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  projectId: string;
  recipientName: string;
  onSent: () => void;
};

export function ComposeModal({
  open,
  onClose,
  pdfBlob,
  filename,
  hasGmail,
  defaultTo,
  defaultSubject,
  defaultBody,
  projectId,
  recipientName,
  onSent,
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const [contactSuggestions, setContactSuggestions] = useState<
    { name: string; email: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Secondary attachment — sent as its own separate file, never merged into the pack PDF
  const [secondaryAttachment, setSecondaryAttachment] = useState<File | null>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);

  function handleSecondaryFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSecondaryAttachment(file);
    e.target.value = "";
  }

  // Reset secondary attachment each time the modal opens
  useEffect(() => {
    if (open) setSecondaryAttachment(null);
  }, [open]);

  // Re-seed fields each time the modal opens (new defaults from fresh draft state)
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setCc("");
    }
  }, [open]); // intentionally only on open change

  // People API autocomplete
  useEffect(() => {
    if (!hasGmail || to.trim().length < 2) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    setShowSuggestions(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gmail/contacts?q=${encodeURIComponent(to)}`);
        const data = await res.json();
        setContactSuggestions(data.contacts ?? []);
      } catch {
        setContactSuggestions([]);
      } finally {
        setContactsLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [to, hasGmail]);

  async function handleSend() {
    if (!to.trim()) {
      toast.error("Recipient email is required.");
      return;
    }
    if (!pdfBlob) {
      toast.error("PDF not ready — please try again.");
      return;
    }
    setSending(true);
    try {
      const bytes = await pdfBlob.arrayBuffer();
      const pdfBase64 = Buffer.from(bytes).toString("base64");

      let secondaryAttachmentPayload:
        | { base64: string; filename: string; mimeType: string }
        | undefined;
      if (secondaryAttachment) {
        const secondaryBytes = await secondaryAttachment.arrayBuffer();
        secondaryAttachmentPayload = {
          base64: Buffer.from(secondaryBytes).toString("base64"),
          filename: secondaryAttachment.name,
          mimeType: secondaryAttachment.type || "application/octet-stream",
        };
      }

      const res = await fetch("/api/gmail/send-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body,
          pdfBase64,
          filename,
          secondaryAttachment: secondaryAttachmentPayload,
          projectId,
          recipientName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }

      toast.success("Submission pack sent successfully.");
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const inputClass =
    "w-full bg-background/60 border border-border rounded-md text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors px-2.5 h-7";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-card">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pt-6 pb-3 bg-card/95 backdrop-blur-xl border-b border-border">
        <span className="text-sm font-medium text-foreground">
          Send Submission Pack
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !hasGmail}
            className="gap-1.5 text-xs"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {sending ? "Sending…" : "Send via Gmail"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4 text-[11px]">
          {!hasGmail && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Gmail not connected. Sign in with Google to send emails.
              </p>
            </div>
          )}

          {/* Recipients */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Recipients
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {/* To */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  To *
                </p>
                <div className="relative">
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    onFocus={() => to.trim().length >= 2 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="recipient@example.com"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                      {contactsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching contacts…
                        </div>
                      ) : contactSuggestions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No contacts found
                        </p>
                      ) : (
                        contactSuggestions.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => {
                              setTo(c.email);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-center gap-2"
                          >
                            {c.name && (
                              <span className="font-medium text-foreground/80 shrink-0">
                                {c.name}
                              </span>
                            )}
                            <span className="text-muted-foreground truncate">
                              {c.email}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CC */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  CC
                </p>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com (optional)"
                  className={inputClass}
                />
              </div>

              {/* Subject */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  Subject
                </p>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Email body
              </h2>
              <span className="text-[10px] text-muted-foreground">
                Submission pack PDF attached automatically
              </span>
            </div>
            <div className="p-4">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={28}
                className="w-full bg-background/60 border border-border rounded-md text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors px-3 py-2 resize-y leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* Attachment info */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border">
            <span className="text-[11px] text-muted-foreground">Attachment:</span>
            <span className="text-[11px] text-foreground/70 font-mono truncate">
              {filename}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
              All selected documents included
            </span>
          </div>

          {/* Secondary attachment — sent as its own file, never merged into the pack PDF */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Secondary attachment
              </h2>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Attach one extra file as its own separate attachment on the email — it is not merged into the submission pack PDF.
              </p>

              <input
                ref={secondaryFileInputRef}
                type="file"
                onChange={handleSecondaryFileAdd}
                className="hidden"
              />

              {secondaryAttachment ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[11px] text-foreground">
                    {secondaryAttachment.name}
                  </span>
                  <button
                    onClick={() => setSecondaryAttachment(null)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => secondaryFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Attach file
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end pb-6">
            <Button
              onClick={handleSend}
              disabled={sending || !hasGmail}
              size="lg"
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending…" : "Send via Gmail"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
