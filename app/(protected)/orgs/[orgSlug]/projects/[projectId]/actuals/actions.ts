"use server";

import { createClient } from "@/lib/supabase/server";

export async function assertActualsAccess(projectId: string): Promise<void> {
  const supabase = createClient();
  const { data: role } = await supabase.rpc("user_project_role", { proj_id: projectId });
  if (!["admin", "project_manager"].includes(role ?? "")) {
    throw new Error("You don't have permission to access Actuals.");
  }
}

export async function createGroup(
  projectId: string,
  orgId: string,
  type: "income" | "expense",
  name: string
) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: last } = await supabase
    .from("actual_groups")
    .select("sort_order")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("actual_groups")
    .insert({
      project_id: projectId,
      org_id: orgId,
      owner_id: user.id,
      type,
      name,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id, type, name, sort_order, is_collapsed, notes")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateGroup(
  groupId: string,
  projectId: string,
  patch: { name?: string; is_collapsed?: boolean; notes?: string }
) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("actual_groups")
    .update(patch)
    .eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function deleteGroup(groupId: string, projectId: string) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("actual_groups")
    .delete()
    .eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function createLineItem(groupId: string, projectId: string) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: last } = await supabase
    .from("actual_line_items")
    .select("sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("actual_line_items")
    .insert({
      group_id: groupId,
      project_id: projectId,
      owner_id: user.id,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, source, retention_applied, included_in_totals")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateLineItem(
  lineItemId: string,
  projectId: string,
  patch: {
    group_id?: string;
    invoice_date?: string | null;
    invoice_number?: string | null;
    supplier?: string | null;
    description?: string;
    qty?: number | null;
    unit_price?: number | null;
    subtotal?: number;
    retention_applied?: boolean;
    included_in_totals?: boolean;
  }
) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("actual_line_items")
    .update(patch)
    .eq("id", lineItemId);
  if (error) throw new Error(error.message);
}

export async function deleteLineItem(lineItemId: string, projectId: string) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("actual_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) throw new Error(error.message);
}

export async function duplicateLines(
  groupId: string,
  projectId: string,
  items: Array<{
    invoice_date: string | null;
    invoice_number: string | null;
    supplier: string | null;
    description: string;
    qty: number | null;
    unit_price: number | null;
    subtotal: number;
  }>
) {
  if (items.length === 0) return [];
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: last } = await supabase
    .from("actual_line_items")
    .select("sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseOrder = (last?.sort_order ?? -1) + 1;

  const rows = items.map((item, i) => ({
    group_id: groupId,
    project_id: projectId,
    owner_id: user.id,
    sort_order: baseOrder + i,
    invoice_date: item.invoice_date,
    invoice_number: item.invoice_number,
    supplier: item.supplier,
    description: item.description,
    qty: item.qty,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
    source: "manual" as const,
  }));

  const { data, error } = await supabase
    .from("actual_line_items")
    .insert(rows)
    .select("id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, source, retention_applied, included_in_totals");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProjectAdminFee(projectId: string, pct: number | null) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ admin_fee_pct: pct })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

export async function updateAdminFeeEstimate(projectId: string, cost: number | null) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ admin_fee_estimated_cost: cost })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

export async function updateProjectRetentionPct(projectId: string, pct: number | null) {
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ retention_pct: pct })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

type ImportLine = {
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
};

export async function importExtractedLines(
  groupId: string,
  projectId: string,
  lines: ImportLine[],
  extractionRunId: string
) {
  if (lines.length === 0) return [];
  await assertActualsAccess(projectId);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const rows = lines.map((l, i) => ({
    group_id: groupId,
    project_id: projectId,
    owner_id: user.id,
    sort_order: i,
    invoice_date: l.invoice_date,
    invoice_number: l.invoice_number,
    supplier: l.supplier,
    description: l.description,
    qty: l.qty,
    unit_price: l.unit_price,
    subtotal: l.subtotal,
    source: "ai_extracted" as const,
    extraction_run_id: extractionRunId,
  }));

  const { data, error } = await supabase
    .from("actual_line_items")
    .insert(rows)
    .select(
      "id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, source, retention_applied, included_in_totals"
    );

  if (error) throw new Error(error.message);
  return data ?? [];
}
