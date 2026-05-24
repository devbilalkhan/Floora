"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateProjectDetails } from "./actions";

export function EditProjectDetailsDialog({
  projectId,
  orgSlug,
  initialLocation,
  initialHeadClient,
  initialNotes,
}: {
  projectId: string;
  orgSlug: string;
  initialLocation: string | null;
  initialHeadClient: string | null;
  initialNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateProjectDetails(projectId, orgSlug, {
        location: (fd.get("location") as string).trim() || null,
        head_client: (fd.get("head_client") as string).trim() || null,
        notes: (fd.get("notes") as string).trim() || null,
      });
      setOpen(false);
      toast.success("Project details updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
          Edit details
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Edit project details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="location"
                className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
              >
                Location
              </Label>
              <Input
                id="location"
                name="location"
                defaultValue={initialLocation ?? ""}
                placeholder="Tamworth NSW"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="head_client"
                className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
              >
                Head client
              </Label>
              <Input
                id="head_client"
                name="head_client"
                defaultValue={initialHeadClient ?? ""}
                placeholder="North Constructions"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="notes"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initialNotes ?? ""}
              placeholder="Optional notes…"
              className="h-20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
