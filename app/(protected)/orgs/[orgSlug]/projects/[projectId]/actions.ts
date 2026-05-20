"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAuthedClient } from "@/lib/supabase/server";

function friendlyError(msg: string): string {
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return msg;
}

async function requireProjectManagerRole(projectId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!["admin", "project_manager"].includes(role ?? "")) {
    throw new Error("You don't have permission to do this.");
  }
}

export async function createEstimate(
  projectId: string,
  orgSlug: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireProjectManagerRole(projectId);
  const { supabase, user } = await createAuthedClient();

  const sourceId = (formData.get("source_takeoff_id") as string) || null;

  const { data, error } = await supabase
    .from("estimates")
    .insert({
      project_id: projectId,
      created_by: user.id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      status: "draft",
      source_takeoff_id: sourceId,
    })
    .select("id")
    .single();

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  return { id: data.id };
}

export async function renameProject(
  projectId: string,
  orgSlug: string,
  name: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .update({ name })
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/orgs/${orgSlug}/projects`);
}

export async function deleteEstimate(
  estimateId: string,
  projectId: string,
  orgSlug: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("estimates")
    .delete()
    .eq("id", estimateId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}
