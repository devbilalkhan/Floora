"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Estimate, EstimateItem, WetArea } from "@/lib/estimate-types";
import { buildEstimateExcelAttachment } from "@/lib/estimate-excel-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function EstimateExcelEmailButton({
  orgName,
  projectName,
  estimate,
  items,
  wetAreas,
  hasGmail,
  variant = "default",
}: {
  orgName: string;
  projectName: string;
  estimate: Estimate;
  items: EstimateItem[];
  wetAreas: WetArea[];
  hasGmail: boolean;
  variant?: "default" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`${projectName} - ${estimate.name} - Cost Estimate`);
  const [message, setMessage] = useState(
    `Hi,\n\nPlease find attached the cost estimate for ${projectName} (${estimate.name}).\n\nKind regards,\n${orgName}`
  );

  async function handleSend() {
    if (!to.trim()) {
      toast.error("Enter a recipient email address.");
      return;
    }
    setSending(true);
    try {
      const { base64, filename } = await buildEstimateExcelAttachment({
        orgName,
        projectName,
        estimate,
        items,
        wetAreas,
      });
      const res = await fetch("/api/gmail/send-costing-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject,
          body: message,
          excelBase64: base64,
          filename,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }
      toast.success(`Excel emailed to ${to.trim()}.`);
      setOpen(false);
      setTo("");
      setCc("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  const isCompact = variant === "compact";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center text-xs transition-colors",
          isCompact
            ? "gap-1 border border-primary/30 rounded px-2 py-0.5 text-primary/80 hover:text-primary"
            : "gap-1.5 border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30"
        )}
      >
        <Mail className={isCompact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
        Email Excel
      </button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Cost Estimate</DialogTitle>
        </DialogHeader>

        {!hasGmail ? (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
            <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">Gmail not connected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                  Sign in with Google
                </Link>{" "}
                to send emails directly from this app.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="excel-email-to">To *</Label>
              <Input
                id="excel-email-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                type="email"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excel-email-cc">CC</Label>
              <Input
                id="excel-email-cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="optional"
                type="email"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excel-email-subject">Subject</Label>
              <Input
                id="excel-email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excel-email-message">Message</Label>
              <Textarea
                id="excel-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={sending || !hasGmail}
            className="gap-1.5 text-xs"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
