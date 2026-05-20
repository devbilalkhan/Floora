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

  const [{ data: tasks }, { data: projects }, { data: members }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", org.id)
        .order("name"),
      supabase
        .from("organization_members")
        .select("user_id, profile:profiles!user_id(display_name, email)")
        .eq("organization_id", org.id),
    ]);

  return {
    currentUserId: user.id,
    tasks: tasks ?? [],
    projects: (projects ?? []) as { id: string; name: string }[],
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
}: {
  orgSlug: string;
  title: string;
  priority: TaskPriority;
  due_date?: string;
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

  const { error } = await supabase.from("tasks").insert({
    org_id: org.id,
    title: title.trim(),
    tags: parseTags(title),
    priority,
    due_date: due_date || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}`);
}

export async function updateTask(
  id: string,
  updates: Partial<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
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
