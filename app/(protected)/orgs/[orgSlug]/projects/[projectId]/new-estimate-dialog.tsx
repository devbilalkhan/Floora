"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createEstimate } from "./actions";

export function NewEstimateDialog({
  projectId,
  orgSlug,
  takeoffs,
}: {
  projectId: string;
  orgSlug: string;
  takeoffs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const { id } = await createEstimate(projectId, orgSlug, new FormData(e.currentTarget));
      setOpen(false);
      router.push(`/orgs/${orgSlug}/projects/${projectId}/estimates/${id}/costing`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create estimate.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" />
          New estimate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>New estimate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Name *
            </Label>
            <Input id="name" name="name" placeholder="Initial quote" required />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="description"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Optional description…"
              className="h-12 resize-none"
            />
          </div>

          {takeoffs.length > 0 && (
            <div className="space-y-1.5">
              <Label
                htmlFor="source_takeoff_id"
                className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
              >
                Import from takeoff
              </Label>
              <select
                id="source_takeoff_id"
                name="source_takeoff_id"
                className="w-full h-8 rounded-md border border-border bg-input px-2.5 text-xs text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">— none —</option>
                {takeoffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create estimate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
