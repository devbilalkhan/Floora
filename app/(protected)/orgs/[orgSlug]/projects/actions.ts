"use server";

import { revalidatePath } from "next/cache";
import { createAuthedClient } from "@/lib/supabase/server";

function friendlyError(msg: string): string {
  if (msg.includes("23505") || msg.includes("unique"))
    return "A project with that name already exists.";
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return "Something went wrong. Please try again.";
}

export async function createProject(
  orgId: string,
  orgSlug: string,
  formData: FormData
) {
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

export async function setProjectStatus(
  projectId: string,
  orgSlug: string,
  status: "active" | "archived"
) {
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects`);
}
