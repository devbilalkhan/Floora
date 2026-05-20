"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { createEstimate } from "../actions";

export function CreateEstimateButton({
  projectId,
  orgSlug,
  takeoffId,
  takeoffName,
}: {
  projectId: string;
  orgSlug: string;
  takeoffId: string;
  takeoffName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("name", takeoffName);
      fd.set("source_takeoff_id", takeoffId);
      const { id } = await createEstimate(projectId, orgSlug, fd);
      toast.success("Estimate created.");
      router.push(`/orgs/${orgSlug}/projects/${projectId}/estimates/${id}/costing`);
    } catch {
      toast.error("Failed to create estimate.");
      setPending(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-primary/40 text-primary rounded-sm hover:bg-primary/10 transition-colors shrink-0 disabled:opacity-50"
    >
      <Calculator className="h-3.5 w-3.5" />
      {pending ? "Creating…" : "Create Estimate"}
    </button>
  );
}
