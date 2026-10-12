"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CornerGuardDefaults, CornerGuardLine } from "@/lib/corner-guard-calc";
import type { CostingInputs } from "@/lib/protection-summary";
import type { WallPanelDefaults, WallPanelLine, WeldRodLine } from "@/lib/wall-panel-calc";
import type { RailLine } from "@/lib/rail-calc";
import type { DoorPanelLine } from "@/lib/door-panel-calc";

/** Rail tab job defaults as stored on protection_estimates (handrails = hr_, crash rail = cr_) */
type RailSettings = {
  hr_default_price: number | null;
  hr_install_rate: number | null;
  cr_default_price: number | null;
  cr_install_rate: number | null;
};

// User-scoped client (not the service role) so the admin/PM-only RLS policies
// on protection_estimates / corner_guard_lines are the access check.

async function getUserClient() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createProtectionEstimate(
  projectId: string,
  orgSlug: string,
  name: string
): Promise<{ id: string }> {
  const { supabase, user } = await getUserClient();
  const { data, error } = await supabase
    .from("protection_estimates")
    .insert({ project_id: projectId, name: name.trim() || "Protection estimate", created_by: user.id })
    .select("id")
    .single();

  if (error) throw new Error("You don't have permission to create protection estimates.");
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  return { id: data.id };
}

export async function renameProtectionEstimate(
  estimateId: string,
  projectId: string,
  orgSlug: string,
  name: string
) {
  const { supabase } = await getUserClient();
  const { error } = await supabase
    .from("protection_estimates")
    .update({ name: name.trim() || "Protection estimate" })
    .eq("id", estimateId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}

/** Notes on the Costing summary — saved on their own so typing doesn't resend the whole estimate. */
export async function updateProtectionNotes(estimateId: string, notes: string) {
  const { supabase } = await getUserClient();
  const { error } = await supabase
    .from("protection_estimates")
    .update({ notes: notes || null })
    .eq("id", estimateId);

  if (error) throw new Error(error.message);
}

export async function deleteProtectionEstimate(estimateId: string, projectId: string, orgSlug: string) {
  const { supabase } = await getUserClient();
  const { error } = await supabase.from("protection_estimates").delete().eq("id", estimateId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}

/** Auto-save: estimate settings (if changed), changed/new lines, and deleted lines for every tab — in parallel. */
export async function saveProtectionEstimate(
  estimateId: string,
  projectId: string,
  changes: {
    /** Every tab's job defaults and the costing summary inputs — all live on protection_estimates */
    settings: (CornerGuardDefaults & CostingInputs & WallPanelDefaults & RailSettings) | null;
    upserts: CornerGuardLine[];
    deletes: string[];
    wallPanels: { upserts: WallPanelLine[]; deletes: string[] };
    weldRods: { upserts: WeldRodLine[]; deletes: string[] };
    handrails: { upserts: RailLine[]; deletes: string[] };
    crashRails: { upserts: RailLine[]; deletes: string[] };
    doorPanels: { upserts: DoorPanelLine[]; deletes: string[] };
  }
) {
  const { supabase } = await getUserClient();

  const results = await Promise.all([
    changes.settings
      ? supabase.from("protection_estimates").update(changes.settings).eq("id", estimateId)
      : null,
    changes.upserts.length
      ? supabase
          .from("corner_guard_lines")
          .upsert(changes.upserts.map((l) => ({ ...l, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.deletes.length
      ? supabase.from("corner_guard_lines").delete().in("id", changes.deletes).eq("estimate_id", estimateId)
      : null,
    changes.wallPanels.upserts.length
      ? supabase
          .from("wall_panel_lines")
          .upsert(changes.wallPanels.upserts.map((l) => ({ ...l, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.wallPanels.deletes.length
      ? supabase.from("wall_panel_lines").delete().in("id", changes.wallPanels.deletes).eq("estimate_id", estimateId)
      : null,
    changes.weldRods.upserts.length
      ? supabase
          .from("wall_panel_weld_rods")
          .upsert(changes.weldRods.upserts.map((r) => ({ ...r, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.weldRods.deletes.length
      ? supabase.from("wall_panel_weld_rods").delete().in("id", changes.weldRods.deletes).eq("estimate_id", estimateId)
      : null,
    changes.handrails.upserts.length
      ? supabase
          .from("handrail_lines")
          .upsert(changes.handrails.upserts.map((l) => ({ ...l, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.handrails.deletes.length
      ? supabase.from("handrail_lines").delete().in("id", changes.handrails.deletes).eq("estimate_id", estimateId)
      : null,
    changes.crashRails.upserts.length
      ? supabase
          .from("crash_rail_lines")
          .upsert(changes.crashRails.upserts.map((l) => ({ ...l, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.crashRails.deletes.length
      ? supabase.from("crash_rail_lines").delete().in("id", changes.crashRails.deletes).eq("estimate_id", estimateId)
      : null,
    changes.doorPanels.upserts.length
      ? supabase
          .from("door_panel_lines")
          .upsert(changes.doorPanels.upserts.map((l) => ({ ...l, estimate_id: estimateId, project_id: projectId })))
      : null,
    changes.doorPanels.deletes.length
      ? supabase.from("door_panel_lines").delete().in("id", changes.doorPanels.deletes).eq("estimate_id", estimateId)
      : null,
  ]);

  const failed = results.find((r) => r?.error);
  if (failed?.error) throw new Error(failed.error.message);
}
