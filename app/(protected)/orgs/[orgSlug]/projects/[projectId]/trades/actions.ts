"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultSheet } from "@/lib/trade-sheet-types";
import type { TradeSheetColumn, TradeSheetRow } from "@/lib/trade-sheet-types";

// These actions use the user-scoped client (not the service role) so the
// admin/PM-only RLS policy on trade_sheets is the access check.

async function getUserClient() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createTradeSheet(
  projectId: string,
  orgSlug: string,
  name: string
): Promise<{ id: string }> {
  const { supabase, user } = await getUserClient();
  const { columns, rows } = defaultSheet();

  const { data, error } = await supabase
    .from("trade_sheets")
    .insert({
      project_id: projectId,
      name: name.trim() || "Untitled sheet",
      columns,
      rows,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error("You don't have permission to create trade sheets.");
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  return { id: data.id };
}

export async function renameTradeSheet(
  sheetId: string,
  projectId: string,
  orgSlug: string,
  name: string
) {
  const { supabase } = await getUserClient();
  const { error } = await supabase
    .from("trade_sheets")
    .update({ name: name.trim() || "Untitled sheet" })
    .eq("id", sheetId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}

export async function deleteTradeSheet(sheetId: string, projectId: string, orgSlug: string) {
  const { supabase } = await getUserClient();
  const { error } = await supabase.from("trade_sheets").delete().eq("id", sheetId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}

/**
 * Saves the whole grid. Only succeeds if the sheet hasn't been changed since
 * `expectedUpdatedAt` — otherwise returns `conflict` so the editor can ask the
 * user to reload instead of silently overwriting someone else's edits.
 */
export async function saveTradeSheet(
  sheetId: string,
  expectedUpdatedAt: string,
  columns: TradeSheetColumn[],
  rows: TradeSheetRow[]
): Promise<{ updatedAt: string } | { conflict: true }> {
  const { supabase, user } = await getUserClient();

  const { data, error } = await supabase
    .from("trade_sheets")
    .update({ columns, rows, updated_by: user.id })
    .eq("id", sheetId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { conflict: true };
  return { updatedAt: data[0].updated_at };
}
