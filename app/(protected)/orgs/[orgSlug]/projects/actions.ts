"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAuthedClient } from "@/lib/supabase/server";

function friendlyError(msg: string): string {
  if (msg.includes("23505") || msg.includes("unique"))
    return "A project with that name already exists.";
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return "Something went wrong. Please try again.";
}

async function requireOrgWriteRole(orgId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_org_role", { org_id: orgId });
  if (!["admin", "project_manager"].includes(role ?? "")) {
    throw new Error("You don't have permission to do this.");
  }
}

async function requireProjectWriteRole(projectId: string) {
  const userDb = createClient();
  const { data: project } = await userDb
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("Project not found.");
  await requireOrgWriteRole(project.organization_id);
}

export async function createProject(
  orgId: string,
  orgSlug: string,
  formData: FormData
) {
  await requireOrgWriteRole(orgId);
  const { supabase, user } = await createAuthedClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      name: formData.get("name") as string,
      location: (formData.get("location") as string) || null,
      head_client: (formData.get("head_client") as string) || null,
      brand: (formData.get("brand") as string) || "spm",
      status: "active",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(friendlyError(error.message));

  revalidatePath(`/orgs/${orgSlug}/projects`);
  return { projectId: data.id };
}

export async function deleteProject(projectId: string, orgSlug: string) {
  await requireProjectWriteRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects`);
}

export async function setProjectStatus(
  projectId: string,
  orgSlug: string,
  status: "active" | "archived"
) {
  await requireProjectWriteRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects`);
}
