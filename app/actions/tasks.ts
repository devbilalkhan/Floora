"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskStatus, TaskPriority } from "@/lib/task-types";

function parseTags(title: string): string[] {
  const matches = title.match(/@([\w-]+)/g) ?? [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase())));
}

export async function getTasksData(orgSlug: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();
  if (!org) return null;

  const [{ data: tasks }, { data: projects }, { data: members }, { data: roleData }, { data: pins }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*, checklist_items:task_checklist_items(id, task_id, text, done, position)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name, start_date, end_date")
        .eq("organization_id", org.id)
        .order("name"),
      supabase
        .from("organization_members")
        .select("user_id, profile:profiles!user_id(display_name, email)")
        .eq("organization_id", org.id),
      supabase.rpc("user_org_role", { org_id: org.id }),
      supabase.from("task_pins").select("task_id").eq("user_id", user.id),
    ]);

  const pinnedIds = new Set((pins ?? []).map((p: any) => p.task_id as string));

  return {
    currentUserId: user.id,
    currentUserRole: (roleData ?? "estimator") as string,
    tasks: (tasks ?? []).map((t: any) => ({
      ...t,
      is_pinned: pinnedIds.has(t.id),
      checklist_items: t.checklist_items ?? [],
    })),
    projects: (projects ?? []) as { id: string; name: string; start_date: string | null; end_date: string | null }[],
    members: (members ?? []).map((m: any) => ({
      user_id: m.user_id as string,
      profile: Array.isArray(m.profile)
        ? (m.profile[0] as { display_name: string | null; email: string | null } | undefined) ?? null
        : (m.profile as { display_name: string | null; email: string | null } | null),
    })),
  };
}

export async function createTask({
  orgSlug,
  title,
  priority,
  due_date,
  is_private = false,
}: {
  orgSlug: string;
  title: string;
  priority: TaskPriority;
  due_date?: string;
  is_private?: boolean;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();
  if (!org) throw new Error("Org not found");

  const { data, error } = await supabase.from("tasks").insert({
    org_id: org.id,
    title: title.trim(),
    tags: parseTags(title),
    priority,
    due_date: due_date || null,
    is_private,
    created_by: user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}`);
  return data.id as string;
}

export async function updateTask(
  id: string,
  updates: Partial<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    is_private: boolean;
  }>,
  orgSlug: string
) {
  const supabase = createClient();
  const payload: Record<string, unknown> = { ...updates };
  if (updates.title !== undefined) payload.tags = parseTags(updates.title);

  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}`);
}

export async function deleteTask(id: string, orgSlug: string) {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}`);
}

export async function addChecklistItem(taskId: string, text: string, orgSlug: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { count } = await supabase
    .from("task_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, text: text.trim(), position: count ?? 0 })
    .select("id, task_id, text, done, position")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}`);
  return data;
}

export async function toggleChecklistItem(itemId: string, done: boolean, orgSlug: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .update({ done })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}`);
}

export async function deleteChecklistItem(itemId: string, orgSlug: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}`);
}

export async function updateProjectDates(
  projectId: string,
  orgSlug: string,
  start_date: string | null,
  end_date: string | null,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { error } = await supabase
    .from("projects")
    .update({ start_date, end_date })
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}`);
}

export async function pinTask(taskId: string, orgSlug: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  const { error } = await supabase.from("task_pins").upsert({ user_id: user.id, task_id: taskId });
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}`);
}

export async function unpinTask(taskId: string, orgSlug: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  const { error } = await supabase.from("task_pins").delete().eq("user_id", user.id).eq("task_id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}`);
}
