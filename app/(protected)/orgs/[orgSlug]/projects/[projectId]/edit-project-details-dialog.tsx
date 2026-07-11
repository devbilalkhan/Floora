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
  initialName,
  initialLocation,
  initialHeadClient,
  initialSpecifier,
  initialContactPerson,
  initialNotes,
  initialRetentionPct,
}: {
  projectId: string;
  orgSlug: string;
  initialName: string;
  initialLocation: string | null;
  initialHeadClient: string | null;
  initialSpecifier: string | null;
  initialContactPerson: string | null;
  initialNotes: string | null;
  initialRetentionPct: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);

    const name = (fd.get("name") as string).trim();
    if (!name) {
      toast.error("Project name is required.");
      setPending(false);
      return;
    }

    const retentionRaw = (fd.get("retention_pct") as string).trim();
    const retention_pct = retentionRaw ? parseFloat(retentionRaw) : null;

    try {
      await updateProjectDetails(projectId, orgSlug, {
        name,
        location:       (fd.get("location") as string).trim() || null,
        head_client:    (fd.get("head_client") as string).trim() || null,
        specifier:      (fd.get("specifier") as string).trim() || null,
        contact_person: (fd.get("contact_person") as string).trim() || null,
        notes:          (fd.get("notes") as string).trim() || null,
        retention_pct:  retention_pct !== null && !isNaN(retention_pct) ? retention_pct : null,
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
        <button
          className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Edit project details"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Edit project details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {/* Project name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Project name
            </Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initialName}
              placeholder="e.g. Westfield Chermside Fitout"
            />
          </div>

          {/* Location + Head client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Address / Location
              </Label>
              <Input
                id="location"
                name="location"
                defaultValue={initialLocation ?? ""}
                placeholder="e.g. Chermside QLD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="head_client" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Head client
              </Label>
              <Input
                id="head_client"
                name="head_client"
                defaultValue={initialHeadClient ?? ""}
                placeholder="e.g. North Constructions"
              />
            </div>
          </div>

          {/* Specifier + Contact person */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="specifier" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Specifier
              </Label>
              <Input
                id="specifier"
                name="specifier"
                defaultValue={initialSpecifier ?? ""}
                placeholder="e.g. Hames Sharley"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_person" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Contact person
              </Label>
              <Input
                id="contact_person"
                name="contact_person"
                defaultValue={initialContactPerson ?? ""}
                placeholder="e.g. James O'Brien"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
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

          {/* Retention */}
          <div className="space-y-1.5">
            <Label htmlFor="retention_pct" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Retention %
            </Label>
            <div className="relative w-40">
              <Input
                id="retention_pct"
                name="retention_pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={initialRetentionPct ?? ""}
                placeholder="e.g. 5"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
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
