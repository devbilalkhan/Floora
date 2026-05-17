"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function NewTakeoffDialog({
  open,
  onOpenChange,
  projectId,
  orgSlug,
  nextSortOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  orgSlug: string;
  nextSortOrder: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setError("Not authenticated"); setSaving(false); return; }

    const { data, error: err } = await supabase
      .from("takeoffs")
      .insert({
        project_id: projectId,
        name: name.trim(),
        sort_order: nextSortOrder,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? "Failed to create takeoff");
      setSaving(false);
      return;
    }

    onOpenChange(false);
    setName("");
    router.push(`/orgs/${orgSlug}/projects/${projectId}/takeoff?takeoffId=${data.id}`);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Takeoff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="takeoff-name" className="text-xs text-muted-foreground uppercase tracking-wide">
              Name
            </Label>
            <Input
              id="takeoff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Broadmeadow Public School"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
