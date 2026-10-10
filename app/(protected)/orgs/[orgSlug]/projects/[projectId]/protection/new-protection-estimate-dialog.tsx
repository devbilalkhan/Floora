"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProtectionEstimate } from "./actions";

export function NewProtectionEstimateDialog({ projectId, orgSlug }: { projectId: string; orgSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const name = new FormData(e.currentTarget).get("name") as string;
      const { id } = await createProtectionEstimate(projectId, orgSlug, name);
      setOpen(false);
      router.push(`/orgs/${orgSlug}/projects/${projectId}/protection/${id}`);
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
          <DialogTitle>New protection estimate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Name *
            </Label>
            <Input id="name" name="name" placeholder="Corner guards — stage 1" required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create estimate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
