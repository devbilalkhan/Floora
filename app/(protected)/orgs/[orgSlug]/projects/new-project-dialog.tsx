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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "./actions";

export function NewProjectDialog({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await createProject(
        orgId,
        orgSlug,
        new FormData(e.currentTarget)
      );
      setOpen(false);
      router.push(`/orgs/${orgSlug}/projects/${result.projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/85 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Project name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Tamworth Hospital Refurb"
              required
            />
          </div>

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
                placeholder="North Constructions"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Brand
            </Label>
            <Select name="brand" defaultValue="spm">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spm">SPM Commercial Flooring</SelectItem>
                <SelectItem value="dfo">DFO Flooring (Residential)</SelectItem>
              </SelectContent>
            </Select>
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
              {pending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
