"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { markPackSent } from "./actions";

export function MarkSentDialog({
  projectId,
  defaultRecipientName,
}: {
  projectId: string;
  defaultRecipientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast.error("Builder name is required.");
      return;
    }
    setPending(true);
    try {
      await markPackSent(projectId, recipientName.trim(), new Date(sentDate).toISOString());
      setOpen(false);
      toast.success("Marked as sent.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRecipientName(defaultRecipientName);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark as Sent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Mark submission pack as sent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Records that this pack was already sent — e.g. outside Gmail, or before this
            project was tracked here. No email is sent.
          </p>

          <div className="space-y-1.5">
            <Label
              htmlFor="recipientName"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Builder / recipient *
            </Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Richard Crookes Constructions"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="sentDate"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Date sent
            </Label>
            <Input
              id="sentDate"
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Mark as sent"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
